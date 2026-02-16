/**
 * channels tablosundaki varchar(255) alanlarını text tipine çevir.
 * Bazı kanal verileri (isim, logo URL, stream URL) 255 karakteri aşabiliyor.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('channels', (table) => {
    table.text('name').notNullable().alter();
    table.text('logo_url').alter();
    table.text('stream_url').notNullable().alter();
    table.text('original_name').alter();
    table.text('epg_channel_id').alter();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('channels', (table) => {
    table.string('name', 255).notNullable().alter();
    table.string('logo_url', 255).alter();
    table.string('stream_url', 255).notNullable().alter();
    table.string('original_name', 255).alter();
    table.string('epg_channel_id', 255).alter();
  });
};
