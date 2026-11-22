/**
 * Zamanlayicinin playlist sync ve EPG yenileme handler'lari.
 *
 * index.js'ten ayrildi ki test edilebilsin. Playlist sync, HTTP ice aktarim
 * yoluyla ayni kilidi alir (ImportJobs): kullanici ayni anda elle sync
 * baslattiysa ya da yedek geri yukluyorsa zamanlanmis is atlanir (`skipped`),
 * iki yazici ayni playlist'e ayni anda dokunmaz.
 */
const db = require('../config/database');
const logger = require('../config/logger');
const importJobs = require('./ImportJobs');

/**
 * @param {{ importService: object, backupService?: object|null }} deps
 * @returns {(row: { id: string, user_id: string, sync_failure_count?: number }) => Promise<object>}
 */
function createPlaylistSyncHandler({ importService, backupService = null }) {
  return async function runScheduledPlaylistSync(row) {
    const { id, user_id: userId } = row;
    const playlist = await db('playlists').where({ id, user_id: userId }).first();
    if (!playlist) return { skipped: true };

    let job;
    try {
      job = importJobs.acquireJob(userId, id, { kind: 'scheduled-sync' });
    } catch (error) {
      if (!importJobs.isBusyError(error)) throw error;
      logger.info({ playlistId: id, userId, reason: error.code }, 'Scheduled playlist sync skipped; an import is already running');
      return { skipped: true };
    }

    try {
      const jobContext = importJobs.jobContextFor(job);
      // Onceki zamanlanmis calistirma basarisizsa yeni yedek alinmaz: ayni
      // (degismemis) icerigin yedegi her denemede tekrar alinip eski
      // yedekleri disari itiyordu.
      const previousFailures = Number(playlist.sync_failure_count ?? row.sync_failure_count) || 0;
      if (playlist.backup_before_sync && backupService && previousFailures === 0) {
        await backupService.createBackup(userId, id, 'scheduled');
      } else if (playlist.backup_before_sync && previousFailures > 0) {
        logger.info({ playlistId: id, previousFailures }, 'Previous scheduled sync failed; pre-sync backup skipped');
      }

      const preview = await importService.previewSync(userId, id);
      jobContext.throwIfCancelled();
      const categories = {};
      for (const [type, typeData] of Object.entries(preview.types || {})) {
        if (!typeData?.available) continue;
        categories[type] = (typeData.categories || [])
          .filter((category) => category.selected)
          .map((category) => category.id);
      }

      const result = await importService.syncFromXtream(userId, id, undefined, jobContext, { categories });
      logger.info({ playlistId: id, userId, partial: result?.partial === true }, 'Scheduled playlist sync completed');
      return { partial: result?.partial === true, result };
    } finally {
      importJobs.releaseJob(job);
    }
  };
}

/**
 * @param {{ epgService: object }} deps
 */
function createEpgRefreshHandler({ epgService }) {
  return async function runScheduledEpgRefresh({ id, user_id: userId }) {
    await epgService.refreshSource(userId, id);
    logger.info({ sourceId: id, userId }, 'Scheduled EPG refresh completed');
  };
}

module.exports = { createPlaylistSyncHandler, createEpgRefreshHandler };
