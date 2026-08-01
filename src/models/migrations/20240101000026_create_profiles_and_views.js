/**
 * Kaydedilen EPG eslestirme profilleri ve playlist gorunum sablonlari.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('epg_match_profiles', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('playlist_id').notNullable().references('id').inTable('playlists').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    // { stripPrefixes: [], stripSuffixes: [], ignoreWords: [], applyOnSync: bool }
    table.jsonb('settings').notNullable().defaultTo('{}');
    table.integer('mapped_count').notNullable().defaultTo(0);
    table.timestamp('last_run_at');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('playlist_views', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('playlist_id').notNullable().references('id').inTable('playlists').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    // Gizli kategori id'leri: ["uuid", ...]
    table.jsonb('hidden_category_ids').notNullable().defaultTo('[]');
    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('epg_match_profiles');
  await knex.schema.dropTableIfExists('playlist_views');
};
