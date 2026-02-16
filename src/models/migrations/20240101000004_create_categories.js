/**
 * Create categories table with indexes.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('categories', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('playlist_id').notNullable().references('id').inTable('playlists').onDelete('CASCADE');
    table.string('name').notNullable();
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX idx_categories_playlist_id ON categories(playlist_id)');
  await knex.raw('CREATE INDEX idx_categories_sort ON categories(playlist_id, sort_order)');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('categories');
};
