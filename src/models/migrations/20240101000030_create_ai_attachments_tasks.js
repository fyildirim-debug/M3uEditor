/**
 * Yapay zeka asistaninin dosya ekleri, onay bekleyen yikici islemleri ve
 * zamanlanmis gorevleri.
 *
 * - ai_attachments: sohbete iliştirilen dosyalar (kind='upload') ve asistanin
 *   urettigi indirilebilir ciktilar (kind='output'). Icerik diskte tutulur,
 *   tabloda yalnizca ustveri ve kisa onizleme durur.
 * - ai_pending_actions: [YIKICI] bir arac cagrisi onay bekliyorsa burada
 *   duraklatilir; kullanici onaylayana kadar arac calistirilmaz.
 * - ai_tasks: "her gece olu kanallari test et" gibi tekrarlayan asistan
 *   gorevleri; SchedulerService dakikada bir vadesi geleni calistirir.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('ai_attachments', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    // Sohbet silinince ekleri de gider; dosya temizligi servis katmaninda.
    table.uuid('conversation_id').references('id').inTable('ai_conversations').onDelete('CASCADE');
    table.string('filename', 255).notNullable();
    table.string('mime', 120).notNullable().defaultTo('text/plain');
    table.string('kind', 20).notNullable().defaultTo('upload');
    // m3u | xmltv | json | csv | text — icerikten tespit edilir, uzantiya guvenilmez.
    table.string('format', 20).notNullable().defaultTo('text');
    table.bigInteger('size_bytes').notNullable().defaultTo(0);
    table.integer('line_count').notNullable().defaultTo(0);
    table.text('preview');
    table.string('storage_path', 500).notNullable();
    table.string('sha256', 64);
    table.jsonb('meta');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
  await knex.raw('CREATE INDEX idx_ai_attachments_user ON ai_attachments(user_id, created_at DESC)');
  await knex.raw('CREATE INDEX idx_ai_attachments_conversation ON ai_attachments(conversation_id)');

  await knex.schema.createTable('ai_pending_actions', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('conversation_id').notNullable().references('id').inTable('ai_conversations').onDelete('CASCADE');
    // Saglayicinin urettigi tool_call kimligi: onaydan sonra ayni cagri calistirilir.
    table.string('tool_call_id', 200).notNullable();
    table.string('tool_name', 120).notNullable();
    table.jsonb('args').notNullable();
    // Onay bekleyen cagri ve ayni turda ondan sonra gelen cagrilar. Saglayici
    // yarim kalan bir turu (bazi tool_call'larin sonucu eksik) reddettigi icin
    // kuyruk butun halinde saklanir; karar verilince sirayla islenir.
    table.jsonb('queued_calls');
    table.text('impact');
    table.string('status', 20).notNullable().defaultTo('pending');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('resolved_at', { useTz: true });
  });
  await knex.raw('CREATE INDEX idx_ai_pending_conversation ON ai_pending_actions(conversation_id, status)');

  await knex.schema.createTable('ai_tasks', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('playlist_id').references('id').inTable('playlists').onDelete('CASCADE');
    table.string('name', 200).notNullable();
    table.text('prompt').notNullable();
    table.integer('interval_minutes').notNullable();
    table.boolean('enabled').notNullable().defaultTo(true);
    // Gorev kendi basina calisir; yikici islem izni gorev bazinda verilir.
    table.boolean('allow_destructive').notNullable().defaultTo(false);
    table.timestamp('last_run_at', { useTz: true });
    table.string('last_status', 20);
    table.text('last_result');
    table.integer('run_count').notNullable().defaultTo(0);
    table.timestamps(true, true);
  });
  await knex.raw('CREATE INDEX idx_ai_tasks_due ON ai_tasks(enabled, last_run_at)');

  await knex.schema.alterTable('ai_settings', (table) => {
    // Acikken her [YIKICI] arac cagrisi kullanici onayi bekler.
    table.boolean('require_approval').notNullable().defaultTo(false);
  });

  await knex.schema.alterTable('ai_messages', (table) => {
    // Mesajla birlikte gonderilen/uretilen dosyalarin ozeti; gecmis yeniden
    // yuklendiginde arayuz ek kartlarini bu alandan cizer.
    table.jsonb('attachments');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('ai_messages', (table) => {
    table.dropColumn('attachments');
  });
  await knex.schema.alterTable('ai_settings', (table) => {
    table.dropColumn('require_approval');
  });
  await knex.schema.dropTableIfExists('ai_tasks');
  await knex.schema.dropTableIfExists('ai_pending_actions');
  await knex.schema.dropTableIfExists('ai_attachments');
};
