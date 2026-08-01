/**
 * Zamanlanmis otomatik guncelleme ve yedekleme alanlari.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('playlists', (table) => {
    // Dakika cinsinden otomatik sync araligi; null = kapali
    table.integer('sync_interval_minutes');
    table.boolean('backup_before_sync').notNullable().defaultTo(false);
  });
  await knex.schema.alterTable('epg_sources', (table) => {
    table.integer('refresh_interval_minutes');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('playlists', (table) => {
    table.dropColumn('sync_interval_minutes');
    table.dropColumn('backup_before_sync');
  });
  await knex.schema.alterTable('epg_sources', (table) => {
    table.dropColumn('refresh_interval_minutes');
  });
};
