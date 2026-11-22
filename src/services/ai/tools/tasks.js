/**
 * Zamanlanmis asistan gorevleri icin araclar.
 *
 * Kullanici "her gece olu kanallari temizle" dediginde asistan bunu bir
 * goreve cevirir; gorev sunucuda calisir, tarayicinin acik olmasi gerekmez.
 */

const { text } = require('../helpers');
const { createAppError } = require('../../../utils/AppError');
const taskService = require('../tasks');

/** Gorev icinden gorev tetiklenmesi sonsuz dongu yaratir; tek kapidan engellenir. */
function assertNotInsideTaskRun(ctx, action) {
  if (ctx.isTaskRun) {
    throw createAppError('FORBIDDEN', `Zamanlanmış bir görev çalışırken "${action}" kullanılamaz.`);
  }
}

/**
 * Gorev, kullanicinin kendi oturumunda sahip olmadigi bir yetkiyle kurulamaz.
 * Kullanici yikici islemleri kapattiysa, asistan "allowDestructive=true" bir
 * gorev kurarak bu ayari arka kapidan acamaz.
 */
function assertDestructiveCeiling(args, ctx) {
  if (args.allowDestructive === true && ctx.allowDestructive !== true) {
    throw createAppError('FORBIDDEN', 'Silme ve üzerine yazma işlemleri kapalıyken yıkıcı izinli görev kurulamaz.');
  }
}

module.exports = {
  list_scheduled_tasks: {
    description: 'Kullanıcının zamanlanmış asistan görevlerini listeler (ad, yönerge, aralık, son çalışma sonucu).',
    parameters: {
      type: 'object',
      properties: { onlyEnabled: { type: 'boolean', description: 'Yalnızca açık görevleri getir (varsayılan false)' } },
    },
    async run(args, ctx) {
      const all = await taskService.list(ctx.userId);
      const tasks = args.onlyEnabled ? all.filter((task) => task.enabled) : all;
      return { count: tasks.length, tasks };
    },
  },

  create_scheduled_task: {
    // Gozetimsiz calisan bir is kurar: onay modunda mutlaka sorulur, bir gorev
    // icinden baska gorev kurulamaz (prompt injection ile kalici arka kapi).
    requiresApproval: true,
    taskRunAllowed: false,
    description: 'Tekrarlayan bir asistan görevi oluşturur. Görev, verilen yönergeyi belirtilen dakika aralığıyla sunucuda kendi başına çalıştırır (örn. 1440 = günde bir). Silme/üzerine yazma gerektiren görevlerde allowDestructive=true verilmelidir; bunu kullanıcıya açıkça sorun.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Kısa görev adı' },
        prompt: { type: 'string', description: 'Görev her çalıştığında asistana verilecek yönerge. Tek başına anlaşılır olmalı; bu sohbete atıfta bulunmamalı.' },
        intervalMinutes: { type: 'integer', description: 'Çalışma aralığı, dakika (en az 15)' },
        playlistId: { type: 'string', description: 'Görevin üzerinde çalışacağı liste' },
        allowDestructive: { type: 'boolean', description: 'Görev silme/üzerine yazma yapabilsin mi (varsayılan false)' },
        enabled: { type: 'boolean' },
      },
      required: ['name', 'prompt', 'intervalMinutes'],
    },
    async run(args, ctx) {
      assertNotInsideTaskRun(ctx, 'create_scheduled_task');
      assertDestructiveCeiling(args, ctx);
      const task = await taskService.create(ctx.userId, {
        name: text(args.name, { field: 'name', max: 200 }),
        prompt: args.prompt,
        intervalMinutes: args.intervalMinutes,
        playlistId: args.playlistId || ctx.playlistId || null,
        allowDestructive: args.allowDestructive === true,
        enabled: args.enabled !== false,
      });
      return {
        ...task,
        note: task.allowDestructive
          ? 'Görev silme/üzerine yazma yapabilir ve kullanıcı onayı sormadan çalışır.'
          : 'Görev yalnızca okuma ve güvenli değişiklik yapabilir.',
      };
    },
  },

  update_scheduled_task: {
    requiresApproval: true,
    taskRunAllowed: false,
    description: 'Zamanlanmış bir görevin adını, yönergesini, aralığını veya açık/kapalı durumunu değiştirir.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        name: { type: 'string' },
        prompt: { type: 'string' },
        intervalMinutes: { type: 'integer' },
        playlistId: { type: 'string' },
        allowDestructive: { type: 'boolean' },
        enabled: { type: 'boolean' },
      },
      required: ['taskId'],
    },
    async run(args, ctx) {
      assertNotInsideTaskRun(ctx, 'update_scheduled_task');
      assertDestructiveCeiling(args, ctx);
      const { taskId, ...patch } = args;
      return taskService.update(ctx.userId, String(taskId).trim(), patch);
    },
  },

  delete_scheduled_task: {
    description: 'Zamanlanmış bir görevi kalıcı olarak siler.',
    destructive: true,
    taskRunAllowed: false,
    parameters: {
      type: 'object',
      properties: { taskId: { type: 'string' } },
      required: ['taskId'],
    },
    async run(args, ctx) {
      assertNotInsideTaskRun(ctx, 'delete_scheduled_task');
      return taskService.remove(ctx.userId, String(args.taskId).trim());
    },
  },

  list_task_runs: {
    description: 'Bir zamanlanmış görevin çalışma geçmişini verir: ne zaman çalıştı, hangi araçlar koştu, kanal/kategori sayısı nasıl değişti ve geri alınabilir mi.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        limit: { type: 'integer' },
      },
      required: ['taskId'],
    },
    async run(args, ctx) {
      const runs = await taskService.listRuns(ctx.userId, String(args.taskId).trim(), args.limit || 10);
      return { count: runs.length, runs };
    },
  },

  undo_task_run: {
    description: 'Bir görev çalıştırmasını geri alır: o turdan önce alınan yedek geri yüklenir. DİKKAT — bu, listeyi o ana döndürür; çalıştırmadan SONRA elle yapılan değişiklikler de kaybolur. Kullanıcıya bunu söyleyip onayını almadan çağırmayın.',
    destructive: true,
    taskRunAllowed: false,
    parameters: {
      type: 'object',
      properties: { runId: { type: 'string', description: 'list_task_runs sonucundaki id' } },
      required: ['runId'],
    },
    async run(args, ctx) {
      assertNotInsideTaskRun(ctx, 'undo_task_run');
      return taskService.undoRun(ctx.userId, String(args.runId).trim());
    },
  },

  run_scheduled_task_now: {
    requiresApproval: true,
    taskRunAllowed: false,
    description: 'Zamanlanmış bir görevi beklemeden hemen bir kez çalıştırır ve sonucunu döndürür.',
    parameters: {
      type: 'object',
      properties: { taskId: { type: 'string' } },
      required: ['taskId'],
    },
    async run(args, ctx) {
      assertNotInsideTaskRun(ctx, 'run_scheduled_task_now');
      const result = await taskService.run(ctx.userId, String(args.taskId).trim(), { manual: true });
      return { taskId: result.taskId, status: result.status, reply: result.reply, toolCount: result.steps?.length || 0 };
    },
  },
};
