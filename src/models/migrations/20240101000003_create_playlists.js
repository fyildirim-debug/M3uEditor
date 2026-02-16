/**
 * Create playlists table with share_token partial index.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('playlists', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('xtream_server_url');
    table.string('xtream_username');
    table.string('xtream_password_enc');
    table.string('share_token').unique();
    table.timestamp('last_synced_at');
    table.timestamps(true, true);
  });

  // Partial index for non-null share tokens
  await knex.raw(
    'CREATE INDEX idx_playlists_share_token ON playlists(share_token) WHERE share_token IS NOT NULL'
  );
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('playlists');
};
