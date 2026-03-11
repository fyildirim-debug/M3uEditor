exports.up = async function (knex) {
  await knex.schema.alterTable('channels', (table) => {
    table.string('original_logo_url');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('channels', (table) => {
    table.dropColumn('original_logo_url');
  });
};
