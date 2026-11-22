/**
 * Asistan guvenlik varsayilanlari.
 *
 * - `require_approval` artik varsayilan olarak acik: kutudan cikan kurulumda
 *   silme/uzerine yazma gibi islemler kullaniciya sorulmadan calisiyordu.
 *   Mevcut satirlara dokunulmaz; kullanicinin bilinçli secimi korunur.
 * - `ai_task_runs.conversation_id`: her gorev calistirmasi kendi sohbetini
 *   acar. Bagi tutulmadigi icin bu sohbetler hic temizlenemiyordu; artik
 *   gorev basina son calistirmalarin sohbeti kalir, eskileri silinir.
 */
exports.up = async function up(knex) {
  await knex.raw('ALTER TABLE ai_settings ALTER COLUMN require_approval SET DEFAULT true');
  await knex.schema.alterTable('ai_task_runs', (table) => {
    table.uuid('conversation_id').references('id').inTable('ai_conversations').onDelete('SET NULL');
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('ai_task_runs', (table) => {
    table.dropColumn('conversation_id');
  });
  await knex.raw('ALTER TABLE ai_settings ALTER COLUMN require_approval SET DEFAULT false');
};
