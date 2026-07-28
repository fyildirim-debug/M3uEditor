exports.up = async function (knex) {
  await knex.schema.createTable('sessions', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('token_hash', 64).notNullable().unique();
    table.timestamp('expires_at').notNullable();
    table.timestamp('last_used_at').defaultTo(knex.fn.now());
    table.timestamp('revoked_at').nullable();
    table.text('user_agent').nullable();
    table.string('ip_address', 64).nullable();
    table.timestamps(true, true);
  });
  await knex.raw('CREATE INDEX idx_sessions_user_active ON sessions(user_id, revoked_at, expires_at)');

  await knex.schema.alterTable('channels', (table) => {
    table.text('source_id').nullable();
    table.uuid('epg_source_id').nullable().references('id').inTable('epg_sources').onDelete('SET NULL');
  });
  await knex.raw("UPDATE channels SET source_id = extras->>'stream_id' WHERE jsonb_typeof(extras) = 'object' AND extras->>'stream_id' IS NOT NULL");
  await knex.raw(`
    UPDATE channels AS duplicate
    SET source_id = NULL
    FROM channels AS keeper
    WHERE duplicate.playlist_id = keeper.playlist_id
      AND duplicate.stream_type = keeper.stream_type
      AND duplicate.source_id = keeper.source_id
      AND duplicate.source_id IS NOT NULL
      AND duplicate.id > keeper.id
  `);
  await knex.raw('CREATE UNIQUE INDEX idx_channels_source_identity ON channels(playlist_id, stream_type, source_id) WHERE source_id IS NOT NULL');
  await knex.raw('CREATE INDEX idx_channels_epg_source ON channels(epg_source_id)');
  await knex.schema.alterTable('epg_sources', (table) => {
    table.string('url_hash', 64).nullable();
    table.text('last_error').nullable();
    table.timestamp('processing_started_at').nullable();
  });
  const sources = await knex('epg_sources').select('id', 'url');
  const crypto = require('crypto');
  for (const source of sources) {
    await knex('epg_sources').where({ id: source.id }).update({
      url_hash: crypto.createHash('sha256').update(source.url).digest('hex'),
    });
  }
  await knex.raw(`
    DELETE FROM epg_sources AS duplicate
    USING epg_sources AS keeper
    WHERE duplicate.user_id = keeper.user_id
      AND duplicate.url_hash = keeper.url_hash
      AND duplicate.url_hash IS NOT NULL
      AND duplicate.id > keeper.id
  `);
  await knex.raw(`
    DELETE FROM epg_channels AS duplicate
    USING epg_channels AS keeper
    WHERE duplicate.source_id = keeper.source_id
      AND duplicate.channel_id = keeper.channel_id
      AND duplicate.id > keeper.id
  `);
  await knex.raw('CREATE UNIQUE INDEX idx_epg_sources_user_url_hash ON epg_sources(user_id, url_hash) WHERE url_hash IS NOT NULL');
  await knex.raw('CREATE UNIQUE INDEX idx_epg_channels_source_channel ON epg_channels(source_id, channel_id)');
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_epg_channels_source_channel');
  await knex.raw('DROP INDEX IF EXISTS idx_epg_sources_user_url_hash');
  await knex.schema.alterTable('epg_sources', (table) => {
    table.dropColumn('processing_started_at');
    table.dropColumn('last_error');
    table.dropColumn('url_hash');
  });
  await knex.raw('DROP INDEX IF EXISTS idx_channels_epg_source');
  await knex.raw('DROP INDEX IF EXISTS idx_channels_source_identity');
  await knex.schema.alterTable('channels', (table) => {
    table.dropColumn('epg_source_id');
    table.dropColumn('source_id');
  });
  await knex.schema.dropTableIfExists('sessions');
};
