/**
 * Create epg_sources table.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('epg_sources', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('url').notNullable();
    table.string('status').notNullable().defaultTo('pending');
    table.timestamp('last_fetched_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('epg_sources');
};
