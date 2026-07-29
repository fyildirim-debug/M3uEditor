exports.up = async function (knex) {
  await knex.schema.alterTable('sessions', (table) => {
    table.uuid('family_id').nullable();
    table.uuid('replaced_by_id').nullable().references('id').inTable('sessions').onDelete('SET NULL');
    table.text('revoke_reason').nullable();
  });

  await knex.raw('UPDATE sessions SET family_id = id WHERE family_id IS NULL');
  await knex.schema.alterTable('sessions', (table) => {
    table.uuid('family_id').notNullable().alter();
  });

  await knex.raw('CREATE INDEX idx_sessions_family_active ON sessions(family_id, revoked_at)');
  await knex.raw('CREATE INDEX idx_sessions_replaced_by ON sessions(replaced_by_id)');
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_sessions_replaced_by');
  await knex.raw('DROP INDEX IF EXISTS idx_sessions_family_active');
  await knex.schema.alterTable('sessions', (table) => {
    table.dropColumn('replaced_by_id');
    table.dropColumn('revoke_reason');
    table.dropColumn('family_id');
  });
};
