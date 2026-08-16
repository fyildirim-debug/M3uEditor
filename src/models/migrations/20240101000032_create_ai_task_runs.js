/**
 * Zamanlanmis asistan gorevlerinin calisma gecmisi.
 *
 * `ai_tasks` yalnizca SON calistirmanin ozetini tutuyordu; gozetimsiz calisan
 * bir gorevin gece ne yaptigini gormek ya da geri almak mumkun degildi. Her
 * calistirma artik burada satirlanir: hangi araclar calisti, kac kanal/kategori
 * degisti ve oncesinde alinan yedek hangisi.
 *
 * Geri alma bu yedege dayanir: `backup_id` restore edilince liste calistirma
 * oncesindeki haline doner. Yedek alinamamis calistirmalar (listesiz gorevler)
 * `undoable=false` isaretlenir — arayuz o satirda geri alma sunmaz.
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('ai_task_runs', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('task_id').notNullable().references('id').inTable('ai_tasks').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('playlist_id').references('id').inTable('playlists').onDelete('SET NULL');
    // running | ok | error | needs_approval
    table.string('status', 20).notNullable().defaultTo('running');
    table.boolean('manual').notNullable().defaultTo(false);
    table.text('summary');
    table.text('error');
    // [{ tool, ok, destructive }] — arayuzde adim listesi.
    table.jsonb('steps');
    // { channelsBefore, channelsAfter, categoriesBefore, categoriesAfter }
    table.jsonb('changes');
    // Yedek silinirse (retention) satir kalsin ama geri alma kapansin.
    table.uuid('backup_id').references('id').inTable('backups').onDelete('SET NULL');
    table.boolean('undoable').notNullable().defaultTo(false);
    table.timestamp('undone_at', { useTz: true });
    table.integer('tool_count').notNullable().defaultTo(0);
    table.integer('duration_ms');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
  await knex.raw('CREATE INDEX idx_ai_task_runs_task ON ai_task_runs(task_id, created_at DESC)');
  await knex.raw('CREATE INDEX idx_ai_task_runs_user ON ai_task_runs(user_id, created_at DESC)');
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('ai_task_runs');
};
