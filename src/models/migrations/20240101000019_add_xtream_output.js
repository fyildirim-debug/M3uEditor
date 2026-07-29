exports.up = async function (knex) {
  await knex.schema.alterTable('playlists', (table) => {
    table.text('output_username').nullable();
    table.text('output_password_hash').nullable();
    table.boolean('output_enabled').notNullable().defaultTo(false);
    table.timestamp('output_created_at', { useTz: true }).nullable();
  });

  await knex.raw(`
    CREATE UNIQUE INDEX idx_playlists_output_username
    ON playlists(output_username)
    WHERE output_username IS NOT NULL
  `);

  // These are protocol-facing stable numeric identifiers. The application
  // keeps its UUID primary keys; BIGSERIAL only supplies Xtream IDs.
  await knex.raw('ALTER TABLE categories ADD COLUMN xtream_id BIGSERIAL');
  await knex.raw('CREATE UNIQUE INDEX idx_categories_xtream_id ON categories(xtream_id)');
  await knex.raw('ALTER TABLE channels ADD COLUMN xtream_id BIGSERIAL');
  await knex.raw('CREATE UNIQUE INDEX idx_channels_xtream_id ON channels(xtream_id)');
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_channels_xtream_id');
  await knex.raw('ALTER TABLE channels DROP COLUMN IF EXISTS xtream_id');
  await knex.raw('DROP INDEX IF EXISTS idx_categories_xtream_id');
  await knex.raw('ALTER TABLE categories DROP COLUMN IF EXISTS xtream_id');
  await knex.raw('DROP INDEX IF EXISTS idx_playlists_output_username');

  await knex.schema.alterTable('playlists', (table) => {
    table.dropColumn('output_created_at');
    table.dropColumn('output_enabled');
    table.dropColumn('output_password_hash');
    table.dropColumn('output_username');
  });
};
