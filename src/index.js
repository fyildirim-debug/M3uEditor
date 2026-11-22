require('dotenv').config();
const logger = require('./config/logger');
const db = require('./config/database');
const app = require('./app');
const SchedulerService = require('./services/SchedulerService');
const ImportService = require('./services/ImportService');
const EPGService = require('./services/EPGService');
const { createPlaylistSyncHandler, createEpgRefreshHandler } = require('./services/ScheduledJobs');
const { describeDatabaseError } = require('./utils/dbErrors');

const importService = new ImportService();
const epgService = new EPGService();
const PORT = process.env.PORT || 3000;

// Zamanlanmis playlist senkronizasyonu: onceki secili kategorilerle sync.
// Handler HTTP ice aktarimiyla ayni kilidi alir; backup_before_sync aciksa ve
// onceki calistirma basarisiz degilse sync oncesi yedek alinir.
SchedulerService.register('playlist-sync', createPlaylistSyncHandler({
  importService,
  backupService: require('./services/BackupService'),
}));

SchedulerService.register('epg-refresh', createEpgRefreshHandler({ epgService }));

// Zamanlanmis asistan gorevleri. Once sahiplenilir (ayni gorev iki kez
// baslamasin), sonra asistan turu calistirilir; sonuc gorev satirina yazilir.
SchedulerService.register('ai-task', async ({ id, user_id: userId }) => {
  const aiTaskService = require('./services/ai/tasks');
  if (!await aiTaskService.claim(id)) return;
  await aiTaskService.run(userId, id);
  logger.info({ taskId: id, userId }, 'Scheduled AI task completed');
});

// Veritabani yoksa API her istekte DATABASE_UNAVAILABLE doner; bunun nedenini
// acilista tek ve anlasilir bir satirda gunluge yaz (Termux/telefon kurulumlarinda
// en sik sorun PostgreSQL'in calismamasi ya da migration'larin uygulanmamasi).
async function checkDatabaseAtBoot() {
  try {
    await db.raw('SELECT 1');
  } catch (error) {
    logger.error({ err: error }, describeDatabaseError(error, db.client?.config?.connection));
    return;
  }
  try {
    const [, pending] = await db.migrate.list();
    if (pending.length) {
      logger.error(
        { pending: pending.map((migration) => migration.file || migration.name || String(migration)) },
        `Veritabanında uygulanmamış ${pending.length} migration var. Sunucuyu başlatmadan önce "npm run migrate" çalıştırın.`
      );
    }
  } catch (error) {
    logger.warn({ err: error }, 'Migration durumu okunamadı');
  }
}

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'M3U Playlist Editor API started');
  checkDatabaseAtBoot();
  SchedulerService.start();
  // Web aramasi calismiyorsa bunu ilk kullanici denemesinde degil, acilista
  // gunlukte gormek gerekir.
  require('./services/WebSearchService').probe().catch(() => {});
});

// Graceful shutdown
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutdown signal received');
  const forcedExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out');
    process.exit(1);
  }, 10000);
  forcedExit.unref();

  server.close(async () => {
    try {
      SchedulerService.stop();
      await db.destroy();
      clearTimeout(forcedExit);
      logger.info('Server and database pool closed');
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, 'Database pool could not be closed');
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (error) => {
  logger.fatal({ err: error }, 'Unhandled promise rejection');
  shutdown('unhandledRejection');
});
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  shutdown('uncaughtException');
});

module.exports = { logger };
