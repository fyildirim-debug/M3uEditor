/**
 * Playlist yedekleri. JSON icerik UPLOAD_DIR/backups altinda gzip'li dosyada;
 * tablo metadata ve retention icin.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('backups', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('playlist_id').notNullable().references('id').inTable('playlists').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('filename', 500).notNullable();
    table.string('playlist_name', 255).notNullable();
    table.integer('channel_count').notNullable().defaultTo(0);
    table.integer('category_count').notNullable().defaultTo(0);
    table.bigInteger('size_bytes').notNullable().defaultTo(0);
    table.string('reason', 20).notNullable().defaultTo('manual'); // manual | pre-sync | scheduled
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
  await knex.raw('CREATE INDEX idx_backups_playlist ON backups(playlist_id, created_at DESC)');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('backups');
};
