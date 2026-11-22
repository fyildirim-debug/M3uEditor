/**
 * Sunucuyu baslatan ortak cekirdek.
 *
 * `src/index.js` (Docker / komut satiri) ve masaustu uygulamasi ayni yolu
 * kullanir: zamanlanmis isler kaydedilir, HTTP dinlemeye baslar, acilista
 * veritabani denetlenir. Surec sinyalleri ve `process.exit` burada YOK —
 * onlar cagiranin isi; masaustunde kapanisi Electron yonetir.
 */
const logger = require('./config/logger');
const db = require('./config/database');
const { describeDatabaseError } = require('./utils/dbErrors');

let jobsRegistered = false;

function registerScheduledJobs() {
  if (jobsRegistered) return;
  jobsRegistered = true;
  const SchedulerService = require('./services/SchedulerService');
  const ImportService = require('./services/ImportService');
  const EPGService = require('./services/EPGService');
  const { createPlaylistSyncHandler, createEpgRefreshHandler } = require('./services/ScheduledJobs');

  // Zamanlanmis playlist senkronizasyonu: onceki secili kategorilerle sync.
  // Handler HTTP ice aktarimiyla ayni kilidi alir; backup_before_sync aciksa ve
  // onceki calistirma basarisiz degilse sync oncesi yedek alinir.
  SchedulerService.register('playlist-sync', createPlaylistSyncHandler({
    importService: new ImportService(),
    backupService: require('./services/BackupService'),
  }));

  SchedulerService.register('epg-refresh', createEpgRefreshHandler({ epgService: new EPGService() }));

  // Zamanlanmis asistan gorevleri. Once sahiplenilir (ayni gorev iki kez
  // baslamasin), sonra asistan turu calistirilir; sonuc gorev satirina yazilir.
  SchedulerService.register('ai-task', async ({ id, user_id: userId }) => {
    const aiTaskService = require('./services/ai/tasks');
    if (!await aiTaskService.claim(id)) return;
    await aiTaskService.run(userId, id);
    logger.info({ taskId: id, userId }, 'Scheduled AI task completed');
  });
}

// Veritabani yoksa API her istekte DATABASE_UNAVAILABLE doner; bunun nedenini
// acilista tek ve anlasilir bir satirda gunluge yaz (Termux/telefon kurulumlarinda
// en sik sorun PostgreSQL'in calismamasi ya da migration'larin uygulanmamasi).
async function checkDatabaseAtBoot() {
  try {
    await db.raw('SELECT 1');
  } catch (error) {
    logger.error({ err: error }, describeDatabaseError(error, db.client?.config?.connection));
    return false;
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
  return true;
}

/**
 * HTTP sunucusunu baslatir.
 *
 * @param {{ port?: number, host?: string, probeWebSearch?: boolean }} [options]
 * @returns {Promise<{ server: import('http').Server, port: number, close: () => Promise<void> }>}
 */
function startServer({ port = Number(process.env.PORT) || 3000, host, probeWebSearch = true } = {}) {
  registerScheduledJobs();
  const app = require('./app');
  const SchedulerService = require('./services/SchedulerService');

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      logger.info({ port: actualPort, host: host || 'all', env: process.env.NODE_ENV || 'development' }, 'M3U Playlist Editor API started');
      checkDatabaseAtBoot();
      SchedulerService.start();
      // Web aramasi calismiyorsa bunu ilk kullanici denemesinde degil, acilista
      // gunlukte gormek gerekir.
      if (probeWebSearch) require('./services/WebSearchService').probe().catch(() => {});

      let closing = null;
      const close = () => {
        if (closing) return closing;
        closing = new Promise((done) => {
          SchedulerService.stop();
          server.close(async () => {
            try {
              await db.destroy();
              logger.info('Server and database pool closed');
            } catch (error) {
              logger.error({ err: error }, 'Database pool could not be closed');
            }
            done();
          });
          // Uzun yasayan baglantilar (SSE, keep-alive) kapanisi bekletmesin.
          server.closeIdleConnections?.();
          setTimeout(() => server.closeAllConnections?.(), 3000).unref();
        });
        return closing;
      };

      resolve({ server, port: actualPort, close });
    });
    server.once('error', reject);
  });
}

module.exports = { startServer, registerScheduledJobs, checkDatabaseAtBoot };
