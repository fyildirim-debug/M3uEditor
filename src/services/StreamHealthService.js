const db = require('../config/database');
const config = require('../config');
const { createAppError } = require('../utils/AppError');
const { requestBuffer, requestStream } = require('../utils/safeFetch');

const TIMEOUT_MS = 8_000;
// Tarama basina toplam paralel istek. Ayni saglayici sunucusuna giden istekler
// ayrica config.healthScan.perHostConcurrency ile sinirlanir (Xtream panelleri
// max_connections asiminda hesabi kilitler).
const CONCURRENCY = 10;
const BATCH_SIZE = 100;

function hostOf(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return '';
  }
}

class StreamHealthService {
  constructor() {
    // Kullanici basina tek aktif tarama (importController'daki acquireJob
    // kullanici-kilidi mantiginin sadelestirilmis hali). Biten isler son
    // durum gorunebilsin diye haritada tutulur; yeni tarama eskisini ezer.
    this.jobsByUser = new Map();
  }

  async _checkViaGet(url) {
    let stream = null;
    try {
      const response = await requestStream(url, {
        method: 'GET',
        headers: { range: 'bytes=0-0' },
        timeoutMs: TIMEOUT_MS,
      });
      stream = response.stream;
      return { ok: true, status: response.status };
    } catch (error) {
      if (error.remoteStatus >= 300 && error.remoteStatus < 400) {
        return { ok: true, status: error.remoteStatus };
      }
      return { ok: false, status: error.remoteStatus ?? null };
    } finally {
      if (stream && !stream.destroyed) stream.destroy();
    }
  }

  // status: HTTP durum kodu (integer); ag hatasinda null.
  async _checkChannel(url) {
    if (!url || typeof url !== 'string') return { ok: false, status: null };
    try {
      const response = await requestBuffer(url, { method: 'HEAD', timeoutMs: TIMEOUT_MS, maxBytes: 1 });
      return { ok: true, status: response.status };
    } catch (error) {
      if (error.remoteStatus === 405) return this._checkViaGet(url);
      // Konum basligi olmayan 3xx yanitlari safeFetch hata olarak dondurur;
      // akis var oldugu icin saglam sayilir.
      if (error.remoteStatus >= 300 && error.remoteStatus < 400) {
        return { ok: true, status: error.remoteStatus };
      }
      return { ok: false, status: error.remoteStatus ?? null };
    }
  }

  /**
   * Tek bir adresi dener. Tarama disindan da kullanilir: StreamRepairService
   * bulunan yeni adresi YAZMADAN once bununla dogrular, boylece bozuk adres
   * baska bir bozuk adresle degistirilip sorun gizlenmez.
   */
  async checkUrl(url) {
    return this._checkChannel(url);
  }

  async _flushBatch(updates) {
    if (!updates.length) return;
    const ids = updates.map((u) => u.id);
    const times = updates.map((u) => u.checkedAt);
    const oks = updates.map((u) => u.ok);
    const statuses = updates.map((u) => u.status);
    await db.raw(
      `UPDATE channels AS c
         SET last_checked_at = u.checked_at,
             last_check_ok = u.ok,
             last_check_status = u.status
        FROM unnest(?::uuid[], ?::timestamptz[], ?::boolean[], ?::integer[])
             AS u(id, checked_at, ok, status)
        WHERE c.id = u.id`,
      [ids, times, oks, statuses]
    );
  }

  /**
   * Bir oynatma listesinin kanallarini tarayip saglik durumlarini yazar.
   * Kullanici icin calisan tarama varsa mevcut isi dondurur (kilit).
   */
  async scanPlaylist(userId, playlistId, { streamType } = {}) {
    const playlist = await db('playlists').where({ id: playlistId, user_id: userId }).first();
    if (!playlist) throw createAppError('NOT_FOUND');
    if (streamType !== undefined && !['live', 'vod', 'series'].includes(streamType)) {
      throw createAppError('VALIDATION_ERROR', 'Geçersiz akış türü');
    }

    const userKey = String(userId);
    const existing = this.jobsByUser.get(userKey);
    if (existing?.running) return existing;
    if (this._runningJobCount() >= config.healthScan.maxJobs) {
      throw createAppError('HEALTH_SCAN_CAPACITY_REACHED');
    }

    // Is, "zaten calisiyor" kontrolu ile ilk await ARASINDA senkron olarak
    // kaydedilir; aksi halde ayni anda gelen iki istek ikisi de kontrolu gecip
    // iki tarama baslatiyordu.
    const job = {
      userId: userKey,
      playlistId,
      running: true,
      checked: 0,
      total: 0,
      dead: 0,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      error: null,
    };
    this.jobsByUser.set(userKey, job);

    let channels;
    try {
      const channelQuery = db('channels')
        .where({ playlist_id: playlistId })
        .select('id', 'stream_url')
        .orderBy('sort_order', 'asc');
      if (streamType) channelQuery.andWhere('stream_type', streamType);
      channels = await channelQuery;
    } catch (error) {
      job.running = false;
      job.error = error.message;
      job.finishedAt = new Date().toISOString();
      throw error;
    }
    job.total = channels.length;

    // Arka planda calistir; POST hemen 202 doner, ilerleme GET ile izlenir.
    this._runScan(job, channels).catch(() => {});
    return job;
  }

  _runningJobCount() {
    let count = 0;
    for (const job of this.jobsByUser.values()) if (job.running) count += 1;
    return count;
  }

  async _runScan(job, channels) {
    let pending = [];
    const checkedAt = new Date().toISOString();

    const flush = async () => {
      if (!pending.length) return;
      const batch = pending;
      pending = [];
      await this._flushBatch(batch);
    };

    // Saglayici sunucusu basina kuyruk: bir host'a ayni anda en fazla
    // perHostConcurrency istek gider, toplam paralellik CONCURRENCY'yi asmaz.
    const perHost = Math.max(1, config.healthScan.perHostConcurrency);
    const queues = new Map();
    for (const channel of channels) {
      const host = hostOf(channel.stream_url);
      if (!queues.has(host)) queues.set(host, []);
      queues.get(host).push(channel);
    }
    const inflightByHost = new Map();
    const takeNext = () => {
      for (const [host, queue] of queues) {
        if ((inflightByHost.get(host) || 0) >= perHost) continue;
        const channel = queue.shift();
        if (!queue.length) queues.delete(host);
        return { host, channel };
      }
      return null;
    };

    const check = async ({ host, channel }) => {
      inflightByHost.set(host, (inflightByHost.get(host) || 0) + 1);
      try {
        const result = await this._checkChannel(channel.stream_url);
        pending.push({ id: channel.id, checkedAt, ok: result.ok, status: result.status });
        job.checked += 1;
        if (!result.ok) job.dead += 1;
        if (pending.length >= BATCH_SIZE) await flush();
      } finally {
        inflightByHost.set(host, inflightByHost.get(host) - 1);
      }
    };

    const runAll = () => new Promise((resolve, reject) => {
      let active = 0;
      let failed = false;
      const pump = () => {
        if (failed) return;
        while (active < CONCURRENCY) {
          const next = takeNext();
          if (!next) break;
          active += 1;
          check(next).then(() => {
            active -= 1;
            pump();
          }, (error) => {
            failed = true;
            reject(error);
          });
        }
        if (active === 0 && !queues.size) resolve();
      };
      pump();
    });

    try {
      await runAll();
      await flush();
    } catch (error) {
      job.error = error.message;
    } finally {
      job.running = false;
      job.finishedAt = new Date().toISOString();
    }
  }

  /**
   * Aktif/gecmis is durumu; is yoksa DB istatistiklerinden turetilir.
   */
  async getScanStatus(userId, playlistId) {
    const playlist = await db('playlists').where({ id: playlistId, user_id: userId }).first();
    if (!playlist) throw createAppError('NOT_FOUND');

    const job = this.jobsByUser.get(String(userId));
    if (job && job.playlistId === playlistId) {
      return {
        running: job.running,
        checked: job.checked,
        total: job.total,
        dead: job.dead,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        error: job.error,
      };
    }
    const stats = await this.getStats(playlistId);
    return {
      running: false,
      checked: stats.total - stats.unchecked,
      total: stats.total,
      dead: stats.dead,
      startedAt: null,
      finishedAt: null,
      error: null,
    };
  }

  async getStats(playlistId) {
    const row = await db('channels')
      .where({ playlist_id: playlistId })
      .select(
        db.raw('COUNT(*)::int AS total'),
        db.raw('COUNT(*) FILTER (WHERE last_check_ok IS TRUE)::int AS ok'),
        db.raw('COUNT(*) FILTER (WHERE last_check_ok IS FALSE)::int AS dead'),
        db.raw('COUNT(*) FILTER (WHERE last_checked_at IS NULL)::int AS unchecked')
      )
      .first();
    return {
      total: row?.total ?? 0,
      ok: row?.ok ?? 0,
      dead: row?.dead ?? 0,
      unchecked: row?.unchecked ?? 0,
    };
  }
}

module.exports = new StreamHealthService();
