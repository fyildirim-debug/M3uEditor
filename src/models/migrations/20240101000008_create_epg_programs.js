/**
 * Create epg_programs table with composite index for time-range queries.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('epg_programs', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('epg_channel_id').notNullable().references('id').inTable('epg_channels').onDelete('CASCADE');
    table.timestamp('start_time').notNullable();
    table.timestamp('end_time').notNullable();
    table.string('title').notNullable();
    table.text('description');
  });

  await knex.raw(
    'CREATE INDEX idx_epg_programs_channel_time ON epg_programs(epg_channel_id, start_time, end_time)'
  );
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('epg_programs');
};
