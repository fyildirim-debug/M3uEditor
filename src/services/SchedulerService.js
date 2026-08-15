/**
 * Zamanlanmis gorev calistiricisi.
 *
 * Dakikada bir kayitli araliklari kontrol eder; vadesi gelen playlist sync'lerini
 * ve EPG kaynak yenilemelerini calistirir. ImportService'in eszamanlilik kapisi
 * (acquireJob) ayni anda en fazla MAX_CONCURRENT_IMPORTS is calistirilmasini
 * zaten garantiler; bu servis yalnizca tetikleyicidir. Her calistirma tek seferde
 * islenir (interval * dakika >= 1) ve hata bir sonraki tura ertelenir.
 */
const db = require('../config/database');
const logger = require('../config/logger');

const TICK_MS = 60_000;

class SchedulerService {
  constructor() {
    this.timer = null;
    this.running = false;
    this.handlers = new Map();
  }

  /**
   * Gorev tipi tanimla. handler(vadesiGelenKayit) => Promise<void>
   * @param {'playlist-sync'|'epg-refresh'} type
   * @param {Function} handler
   */
  register(type, handler) {
    this.handlers.set(type, handler);
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this._tick().catch((error) => {
      logger.warn({ err: error }, 'Scheduler tick failed');
    }), TICK_MS);
    this.timer.unref?.();
    logger.info('Scheduler started');
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  async _tick() {
    if (this.running) return; // onceki tick hala suruyor
    this.running = true;
    try {
      const now = new Date();
      if (this.handlers.has('playlist-sync')) {
        const due = await db('playlists')
          .whereNotNull('sync_interval_minutes')
          .whereNotNull('xtream_server_url')
          .whereRaw(`COALESCE(last_synced_at, created_at) + (sync_interval_minutes || ' minutes')::interval <= ?`, [now])
          .select('id', 'user_id');
        for (const row of due) {
          await this.handlers.get('playlist-sync')(row).catch((error) => {
            logger.warn({ err: error, playlistId: row.id }, 'Scheduled playlist sync failed');
          });
        }
      }
      if (this.handlers.has('ai-task')) {
        const dueTasks = await db('ai_tasks')
          .where({ enabled: true })
          .andWhereRaw(`(last_run_at IS NULL OR last_run_at + (interval_minutes || ' minutes')::interval <= ?)`, [now])
          .select('id', 'user_id');
        for (const row of dueTasks) {
          // Bir asistan gorevi dakikalarca surebilir. Beklenirse sonraki tick
          // gecikir, beklenmezse gorev her tick'te yeniden baslar; bu yuzden
          // handler once gorevi sahiplenir (last_run_at'i ileri alir), sonra
          // arka planda calistirir ve tick beklemeden devam eder.
          this.handlers.get('ai-task')(row).catch((error) => {
            logger.warn({ err: error, taskId: row.id }, 'Scheduled AI task failed');
          });
        }
      }
      if (this.handlers.has('epg-refresh')) {
        const dueSources = await db('epg_sources')
          .whereNotNull('refresh_interval_minutes')
          .whereRaw(`COALESCE(last_fetched_at, created_at) + (refresh_interval_minutes || ' minutes')::interval <= ?`, [now])
          .select('id', 'user_id');
        for (const row of dueSources) {
          await this.handlers.get('epg-refresh')(row).catch((error) => {
            logger.warn({ err: error, sourceId: row.id }, 'Scheduled EPG refresh failed');
          });
        }
      }
    } finally {
      this.running = false;
    }
  }
}

module.exports = new SchedulerService();
