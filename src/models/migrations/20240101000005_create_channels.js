/**
 * Create channels table with all required indexes including trigram index.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('channels', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('playlist_id').notNullable().references('id').inTable('playlists').onDelete('CASCADE');
    table.uuid('category_id').references('id').inTable('categories').onDelete('SET NULL');
    table.string('name').notNullable();
    table.string('logo_url');
    table.string('stream_url').notNullable();
    table.string('epg_channel_id');
    table.integer('sort_order').notNullable().defaultTo(0);
    table.string('original_name');
    table.jsonb('extras');
    table.timestamps(true, true);

    // Unique constraint for bulk upsert ON CONFLICT strategy
    table.unique(['playlist_id', 'stream_url']);
  });

  await knex.raw('CREATE INDEX idx_channels_playlist_id ON channels(playlist_id)');
  await knex.raw('CREATE INDEX idx_channels_category_id ON channels(category_id)');
  await knex.raw('CREATE INDEX idx_channels_playlist_sort ON channels(playlist_id, sort_order)');
  // Trigram index for fuzzy channel name search (requires pg_trgm extension)
  await knex.raw('CREATE INDEX idx_channels_name_trgm ON channels USING gin(name gin_trgm_ops)');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('channels');
};
