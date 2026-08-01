/**
 * Coklu kaynak birlestirme: bir playlist'in ana Xtream kaynagi playlists.xtream_*
 * kolonlarinda kalir; ek Xtream kaynaklari bu tabloda tutulur. sync-all ana
 * kaynak + buradaki kaynaklari sirayla calistirir; kategoriler isimle birlesir.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('playlist_sources', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('playlist_id').notNullable().references('id').inTable('playlists').onDelete('CASCADE');
    table.string('server_url', 2048).notNullable();
    table.string('username', 500).notNullable();
    table.text('password_enc').notNullable();
    table.string('label', 255);
    table.integer('position').notNullable().defaultTo(0);
    // null = hic senkronize edilmedi; sync-all ilk calistirmada tam cekim yapar
    table.timestamp('last_synced_at', { useTz: true });
    table.timestamps(true, true);
  });
  await knex.raw('CREATE INDEX idx_playlist_sources_playlist ON playlist_sources(playlist_id, position)');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('playlist_sources');
};
