/**
 * Regex filtre kurallari: sync/import sirasinda kanallari otomatik dahil et/haric tut.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('filter_rules', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('playlist_id').notNullable().references('id').inTable('playlists').onDelete('CASCADE');
    table.string('field', 20).notNullable(); // group | name | url
    table.string('pattern', 500).notNullable();
    table.boolean('exclude').notNullable().defaultTo(true);
    table.boolean('enabled').notNullable().defaultTo(true);
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamps(true, true);
  });
  await knex.raw('CREATE INDEX idx_filter_rules_playlist ON filter_rules(playlist_id, sort_order)');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('filter_rules');
};
