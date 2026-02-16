/**
 * Create epg_channels table with source index.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('epg_channels', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('source_id').notNullable().references('id').inTable('epg_sources').onDelete('CASCADE');
    table.string('channel_id').notNullable();
    table.string('display_name');
    table.string('icon_url');
  });

  await knex.raw('CREATE INDEX idx_epg_channels_source ON epg_channels(source_id)');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('epg_channels');
};
