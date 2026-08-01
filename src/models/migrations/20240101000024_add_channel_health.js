/**
 * Akis saglik kontrolu sonuclari kanal satirinda tutulur.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('channels', (table) => {
    table.timestamp('last_checked_at');
    table.boolean('last_check_ok');
    table.integer('last_check_status');
  });
  await knex.raw('CREATE INDEX idx_channels_health ON channels(playlist_id, last_check_ok)');
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_channels_health');
  await knex.schema.alterTable('channels', (table) => {
    table.dropColumn('last_checked_at');
    table.dropColumn('last_check_ok');
    table.dropColumn('last_check_status');
  });
};
