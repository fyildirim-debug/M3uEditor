/**
 * Zamanlanmis gorev calistiricisi.
 *
 * Dakikada bir kayitli araliklari kontrol eder; vadesi gelen playlist sync'lerini
 * ve EPG kaynak yenilemelerini calistirir. Playlist sync handler'i HTTP yoluyla
 * ayni ice aktarim kilidini (ImportJobs.acquireJob) alir; kilit mesgulse is
 * `{ skipped: true }` doner ve bir sonraki tick'te yeniden denenir.
 *
 * Hata (ya da kismi sync) zaman damgasini ilerletmez. Eskiden bu yuzden basarisiz
 * is her dakika yeniden calisiyordu; artik ardisik hata sayisi ve bir sonraki
 * deneme zamani (ustel geri cekilme, bkz. utils/backoff) saklanir ve vade
 * sorgulari bu zamandan once isi secmez. Basarida sayac sifirlanir.
 */
const db = require('../config/database');
const config = require('../config');
const logger = require('../config/logger');
const { nextAttemptAt } = require('../utils/backoff');

const TICK_MS = 60_000;
// Yavas bir EPG kaynagi (100 MB'a kadar, 5 dk zaman asimi) digerlerini
// beklettiginden EPG yenilemeleri sinirli paralellikle calisir.
const EPG_TICK_CONCURRENCY = 2;

/** Ayni anda en fazla `limit` ogeyi isler; hatalar worker icinde ele alinir. */
async function runWithConcurrency(items, limit, worker) {
  let cursor = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await worker(item);
    }
  });
  await Promise.all(lanes);
}

class SchedulerService {
  constructor() {
    this.timer = null;
    this.running = false;
    this.handlers = new Map();
  }

  /**
   * Gorev tipi tanimla. handler(vadesiGelenKayit) => Promise<void|{ skipped?: boolean, partial?: boolean }>
   * Firlatilan hata ya da `partial: true` geri cekilmeyi baslatir; `skipped: true`
   * (ornegin ice aktarim kilidi mesgul) hicbir sey kaydetmez.
   * @param {'playlist-sync'|'epg-refresh'|'ai-task'} type
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

  _minInterval() {
    return config.scheduler.minSyncIntervalMinutes;
  }

  /**
   * Vadesi gelen playlist'ler: aralik (tabana cekilmis) dolmus ve geri cekilme
   * suresi gecmis olmali.
   */
  async _duePlaylists(now) {
    return db('playlists')
      .whereNotNull('sync_interval_minutes')
      .whereNotNull('xtream_server_url')
      .andWhere((query) => query.whereNull('sync_next_attempt_at').orWhere('sync_next_attempt_at', '<=', now))
      .whereRaw(`COALESCE(last_synced_at, created_at) + (GREATEST(sync_interval_minutes, ?) || ' minutes')::interval <= ?`, [this._minInterval(), now])
      .select('id', 'user_id', 'sync_interval_minutes', 'sync_failure_count');
  }

  async _dueEpgSources(now) {
    return db('epg_sources')
      .whereNotNull('refresh_interval_minutes')
      .andWhere((query) => query.whereNull('next_attempt_at').orWhere('next_attempt_at', '<=', now))
      .whereRaw(`COALESCE(last_fetched_at, created_at) + (GREATEST(refresh_interval_minutes, ?) || ' minutes')::interval <= ?`, [this._minInterval(), now])
      .select('id', 'user_id', 'refresh_interval_minutes', 'failure_count');
  }

  /**
   * Bir zamanlanmis calistirmanin sonucunu kaydeder.
   * @param {{ table: string, countColumn: string, nextColumn: string, interval: number|null }} target
   * @param {object} row - vade sorgusundan gelen satir
   * @param {boolean} failed
   */
  async _recordOutcome({ table, countColumn, nextColumn, interval }, row, failed) {
    const previous = Number(row[countColumn]) || 0;
    if (!failed) {
      if (previous > 0) {
        await db(table).where({ id: row.id }).update({ [countColumn]: 0, [nextColumn]: null });
      }
      return;
    }
    const failures = previous + 1;
    const effectiveInterval = Math.max(Number(interval) || 0, this._minInterval());
    const next = nextAttemptAt(effectiveInterval, failures);
    await db(table).where({ id: row.id }).update({ [countColumn]: failures, [nextColumn]: next });
    logger.info({ table, id: row.id, failures, nextAttemptAt: next.toISOString() }, 'Scheduled job failed; backing off');
  }

  async _runPlaylistSync(row) {
    const target = {
      table: 'playlists', countColumn: 'sync_failure_count', nextColumn: 'sync_next_attempt_at', interval: row.sync_interval_minutes,
    };
    let outcome;
    try {
      outcome = await this.handlers.get('playlist-sync')(row);
    } catch (error) {
      logger.warn({ err: error, playlistId: row.id }, 'Scheduled playlist sync failed');
      await this._recordOutcome(target, row, true).catch((recordError) => {
        logger.warn({ err: recordError, playlistId: row.id }, 'Scheduled sync failure could not be recorded');
      });
      return;
    }
    // Kilit mesgul: hata degil, bir sonraki tick'te tekrar denenir.
    if (outcome?.skipped) return;
    // Kismi sync last_synced_at'i ilerletmez; geri cekilme olmadan her tick'te tekrar calisirdi.
    await this._recordOutcome(target, row, outcome?.partial === true).catch((recordError) => {
      logger.warn({ err: recordError, playlistId: row.id }, 'Scheduled sync outcome could not be recorded');
    });
  }

  async _runEpgRefresh(row) {
    const target = {
      table: 'epg_sources', countColumn: 'failure_count', nextColumn: 'next_attempt_at', interval: row.refresh_interval_minutes,
    };
    let failed = false;
    try {
      await this.handlers.get('epg-refresh')(row);
    } catch (error) {
      failed = true;
      logger.warn({ err: error, sourceId: row.id }, 'Scheduled EPG refresh failed');
    }
    await this._recordOutcome(target, row, failed).catch((recordError) => {
      logger.warn({ err: recordError, sourceId: row.id }, 'Scheduled EPG outcome could not be recorded');
    });
  }

  async _tick() {
    if (this.running) return; // onceki tick hala suruyor
    this.running = true;
    try {
      const now = new Date();
      if (this.handlers.has('playlist-sync')) {
        const due = await this._duePlaylists(now);
        for (const row of due) {
          await this._runPlaylistSync(row);
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
        const dueSources = await this._dueEpgSources(now);
        await runWithConcurrency(dueSources, EPG_TICK_CONCURRENCY, (row) => this._runEpgRefresh(row));
      }
    } finally {
      this.running = false;
    }
  }
}

module.exports = new SchedulerService();
