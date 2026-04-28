/**
 * Plan/premium sistemi kaldırıldı — proje tamamen ücretsiz açık kaynak.
 * users tablosundan plan ile ilgili kolonları düşür.
 */
exports.up = async function(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('plan');
    table.dropColumn('plan_expires_at');
    table.dropColumn('max_playlists');
    table.dropColumn('max_channels_per_playlist');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.string('plan', 20).defaultTo('free');
    table.timestamp('plan_expires_at').nullable();
    table.integer('max_playlists').defaultTo(3);
    table.integer('max_channels_per_playlist').defaultTo(500);
  });
};
