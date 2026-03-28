/**
 * EPG tablolarındaki varchar(255) kolonları text'e çevir.
 * Xtream Codes EPG verileri 255 karakteri aşabilen icon_url ve display_name içerebiliyor.
 */
exports.up = async function (knex) {
  // epg_channels: channel_id, display_name, icon_url → text
  await knex.schema.alterTable('epg_channels', (table) => {
    table.text('channel_id').notNullable().alter();
    table.text('display_name').alter();
    table.text('icon_url').alter();
  });

  // epg_programs: title → text
  await knex.schema.alterTable('epg_programs', (table) => {
    table.text('title').notNullable().alter();
  });

  // epg_sources: url → text
  await knex.schema.alterTable('epg_sources', (table) => {
    table.text('url').notNullable().alter();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('epg_channels', (table) => {
    table.string('channel_id').notNullable().alter();
    table.string('display_name').alter();
    table.string('icon_url').alter();
  });

  await knex.schema.alterTable('epg_programs', (table) => {
    table.string('title').notNullable().alter();
  });

  await knex.schema.alterTable('epg_sources', (table) => {
    table.string('url').notNullable().alter();
  });
};
