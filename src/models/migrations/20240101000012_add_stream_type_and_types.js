/**
 * Add stream_type column to channels and xtream_stream_types to playlists.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('channels', (table) => {
    table.string('stream_type', 20).notNullable().defaultTo('live');
  });

  await knex.schema.alterTable('playlists', (table) => {
    table.text('xtream_stream_types');
  });

  await knex.raw('CREATE INDEX idx_channels_stream_type ON channels(stream_type)');
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_channels_stream_type');

  await knex.schema.alterTable('channels', (table) => {
    table.dropColumn('stream_type');
  });

  await knex.schema.alterTable('playlists', (table) => {
    table.dropColumn('xtream_stream_types');
  });
};
