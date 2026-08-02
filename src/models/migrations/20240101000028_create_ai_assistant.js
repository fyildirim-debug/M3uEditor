/**
 * Yapay zeka asistani: kullanici basina OpenAI uyumlu saglayici ayarlari
 * (base URL + sifreli API anahtari + model) ve sohbet gecmisi.
 * Anahtar `credential_encryption_key` ile sifrelenir, hicbir zaman duz metin
 * olarak istemciye donmez.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('ai_settings', (table) => {
    table.uuid('user_id').primary().references('id').inTable('users').onDelete('CASCADE');
    table.string('base_url', 2048).notNullable().defaultTo('https://api.openai.com/v1');
    table.text('api_key_enc');
    table.string('model', 200);
    table.decimal('temperature', 3, 2).notNullable().defaultTo(0.2);
    table.integer('max_steps').notNullable().defaultTo(12);
    table.boolean('allow_destructive').notNullable().defaultTo(true);
    table.text('system_prompt');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('ai_conversations', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('playlist_id').references('id').inTable('playlists').onDelete('SET NULL');
    table.string('title', 300);
    table.timestamps(true, true);
  });
  await knex.raw('CREATE INDEX idx_ai_conversations_user ON ai_conversations(user_id, updated_at DESC)');

  await knex.schema.createTable('ai_messages', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('conversation_id').notNullable().references('id').inTable('ai_conversations').onDelete('CASCADE');
    table.string('role', 20).notNullable();
    table.text('content');
    // OpenAI arac cagrilari ve sonuclari; gecmis yeniden gonderilirken aynen kullanilir
    table.jsonb('tool_calls');
    table.string('tool_call_id', 200);
    table.string('name', 200);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
  await knex.raw('CREATE INDEX idx_ai_messages_conversation ON ai_messages(conversation_id, created_at)');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('ai_messages');
  await knex.schema.dropTableIfExists('ai_conversations');
  await knex.schema.dropTableIfExists('ai_settings');
};
