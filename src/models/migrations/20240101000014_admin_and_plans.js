exports.up = async function(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.boolean('is_admin').defaultTo(false);
    table.string('plan', 20).defaultTo('free');
    table.timestamp('plan_expires_at').nullable();
    table.integer('max_playlists').defaultTo(3);
    table.integer('max_channels_per_playlist').defaultTo(500);
    table.timestamp('email_verified_at').nullable();
    table.text('password_reset_token').nullable();
    table.timestamp('password_reset_expires').nullable();
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('is_admin');
    table.dropColumn('plan');
    table.dropColumn('plan_expires_at');
    table.dropColumn('max_playlists');
    table.dropColumn('max_channels_per_playlist');
    table.dropColumn('email_verified_at');
    table.dropColumn('password_reset_token');
    table.dropColumn('password_reset_expires');
  });
};
