exports.up = async function(knex) {
  // Make epg_programs.end_time nullable (fix bug)
  await knex.schema.alterTable('epg_programs', (table) => {
    table.timestamp('end_time').nullable().alter();
  });

  // Add share_expires_at and share_password to playlists
  await knex.schema.alterTable('playlists', (table) => {
    table.timestamp('share_expires_at').nullable();
    table.text('share_password').nullable();
  });

  // Add refresh_token to users
  await knex.schema.alterTable('users', (table) => {
    table.text('refresh_token').nullable();
    table.timestamp('refresh_token_expires_at').nullable();
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('epg_programs', (table) => {
    table.timestamp('end_time').notNullable().alter();
  });
  await knex.schema.alterTable('playlists', (table) => {
    table.dropColumn('share_expires_at');
    table.dropColumn('share_password');
  });
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('refresh_token');
    table.dropColumn('refresh_token_expires_at');
  });
};
