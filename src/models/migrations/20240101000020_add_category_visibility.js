exports.up = async function (knex) {
  await knex.schema.alterTable('categories', (table) => {
    table.boolean('is_hidden').notNullable().defaultTo(false);
  });

  await knex.raw('CREATE INDEX idx_categories_playlist_hidden ON categories(playlist_id, is_hidden)');
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_categories_playlist_hidden');

  await knex.schema.alterTable('categories', (table) => {
    table.dropColumn('is_hidden');
  });
};
