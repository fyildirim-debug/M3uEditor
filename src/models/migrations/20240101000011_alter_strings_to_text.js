exports.up = async function (knex) {
  await knex.schema.alterTable('channels', (table) => {
    table.text('name').notNullable().alter();
    table.text('logo_url').alter();
    table.text('stream_url').notNullable().alter();
    table.text('epg_channel_id').alter();
    table.text('original_name').alter();
    table.text('original_logo_url').alter();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('channels', (table) => {
    table.string('name').notNullable().alter();
    table.string('logo_url').alter();
    table.string('stream_url').notNullable().alter();
    table.string('epg_channel_id').alter();
    table.string('original_name').alter();
    table.string('original_logo_url').alter();
  });
};
