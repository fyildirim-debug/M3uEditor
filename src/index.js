require('dotenv').config();
const logger = require('./config/logger');
const db = require('./config/database');
const app = require('./app');
const SchedulerService = require('./services/SchedulerService');
const ImportService = require('./services/ImportService');
const EPGService = require('./services/EPGService');

const importService = new ImportService();
const epgService = new EPGService();
const PORT = process.env.PORT || 3000;

// Zamanlanmis playlist senkronizasyonu: onceki secili kategorilerle sync.
// backup_before_sync aciksa sync oncesi yedek alinir; BackupService baska bir
// modulde yasiyor — yuklenemezse yedek atlanir, sync yine de calisir.
SchedulerService.register('playlist-sync', async ({ id, user_id: userId }) => {
  const playlist = await db('playlists').where({ id, user_id: userId }).first();
  if (!playlist) return;

  if (playlist.backup_before_sync) {
    try {
      // eslint-disable-next-line global-require
      const BackupService = require('./services/BackupService');
      await BackupService.createBackup(userId, id, 'scheduled');
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
      logger.info({ playlistId: id }, 'BackupService bulunamadi; zamanlanmis yedek atlandi');
    }
  }

  const preview = await importService.previewSync(userId, id);
  const categories = {};
  for (const [type, typeData] of Object.entries(preview.types || {})) {
    if (!typeData?.available) continue;
    categories[type] = (typeData.categories || [])
      .filter((category) => category.selected)
      .map((category) => category.id);
  }

  await importService.syncFromXtream(userId, id, undefined, undefined, { categories });
  logger.info({ playlistId: id, userId }, 'Scheduled playlist sync completed');
});

SchedulerService.register('epg-refresh', async ({ id, user_id: userId }) => {
  await epgService.refreshSource(userId, id);
  logger.info({ sourceId: id, userId }, 'Scheduled EPG refresh completed');
});

// Zamanlanmis asistan gorevleri. Once sahiplenilir (ayni gorev iki kez
// baslamasin), sonra asistan turu calistirilir; sonuc gorev satirina yazilir.
SchedulerService.register('ai-task', async ({ id, user_id: userId }) => {
  const aiTaskService = require('./services/ai/tasks');
  if (!await aiTaskService.claim(id)) return;
  await aiTaskService.run(userId, id);
  logger.info({ taskId: id, userId }, 'Scheduled AI task completed');
});

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'M3U Playlist Editor API started');
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
