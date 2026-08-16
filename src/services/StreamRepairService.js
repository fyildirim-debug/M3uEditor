/**
 * StreamRepairService — calismayan kanallarin adresini calisan bir kaynaktan
 * tazeler.
 *
 * Saglayicilar akis adreslerini sik degistirir; liste bozulur ama kanallarin
 * kendisi (ad, kategori, logo, EPG eslesmesi) dogrudur. Bugune kadar tek secenek
 * olu kanali SILMEK ya da listeyi bastan ICE AKTARMAK'ti; ikisi de yapilan
 * duzenlemeyi cope atiyor. Bu servis uctan uca sunu yapar:
 *
 *   1. Hedef kanallari belirle (olu isaretliler ya da acikca verilenler)
 *   2. Kaynak Xtream katalogunu cek, adlarindan eslestirme anahtari uret
 *   3. Her bozuk kanal icin karsiligini bul
 *   4. Yeni adresi YAZMADAN once dogrula (istege bagli ama varsayilan acik)
 *   5. Yalnizca stream_url'i degistir — ad, kategori, logo, EPG eslesmesi kalir
 *
 * Kimlik bilgisi verilmezse listenin kendi kayitli Xtream bilgisi kullanilir;
 * boylece kullanicinin parolayi tekrar yazmasi gerekmez.
 */

const db = require('../config/database');
const logger = require('../config/logger');
const XtreamClient = require('./XtreamClient');
const streamHealthService = require('./StreamHealthService');
const { decrypt } = require('../utils/crypto');
const { createAppError } = require('../utils/AppError');
const { matchKey } = require('../utils/channelName');

// Tek cagride onarilacak kanal tavani: her biri bir HTTP dogrulamasi demek.
const MAX_TARGETS = 1000;
// Aday adresleri dogrularken es zamanli istek sayisi.
const VERIFY_CONCURRENCY = 8;

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  });
  await Promise.all(runners);
  return results;
}

class StreamRepairService {
  /** Kimlik bilgisi verilmediyse listenin kendi kayitli Xtream bilgisine duser. */
  async _resolveCredentials(playlist, override = {}) {
    const serverUrl = override.serverUrl || playlist.xtream_server_url;
    const username = override.username || playlist.xtream_username;
    const password = override.password
      || (playlist.xtream_password_enc ? decrypt(playlist.xtream_password_enc) : null);

    if (!serverUrl || !username || !password) {
      throw createAppError('VALIDATION_ERROR',
        'Xtream bilgisi yok. Bu listede kayıtlı bir Xtream kaynağı bulunmadığı için sunucu adresi, kullanıcı adı ve parola vermeniz gerekiyor.');
    }
    return { serverUrl, username, password };
  }

  async _targets(playlistId, { channelIds, onlyDead, streamType, limit }) {
    const query = db('channels').where({ playlist_id: playlistId });
    if (Array.isArray(channelIds) && channelIds.length) {
      query.whereIn('id', channelIds.map((id) => String(id).trim()).filter(Boolean));
    } else if (onlyDead !== false) {
      // Yalnizca taramada BASARISIZ olanlar. Hic test edilmemis kanallar
      // (last_check_ok null) dahil edilmez: calisiyor olabilirler ve
      // adreslerini gereksiz yere degistirmek zarar verir.
      query.andWhere('last_check_ok', false);
    }
    if (streamType) query.andWhere('stream_type', streamType);

    const cap = Math.min(Math.max(Number(limit) || MAX_TARGETS, 1), MAX_TARGETS);
    return query.select('id', 'name', 'stream_url', 'stream_type').orderBy('sort_order', 'asc').limit(cap);
  }

  /** Kaynak katalogundan ad anahtari -> adres haritasi. */
  async _sourceIndex(credentials, streamTypes) {
    const client = new XtreamClient(credentials.serverUrl, credentials.username, credentials.password);
    await client.authenticate();
    const { channels } = await client.getAllChannels(streamTypes, {});

    const index = new Map();
    for (const channel of channels) {
      const key = matchKey(channel.name);
      if (!key || !channel.url) continue;
      // Ayni ada birden fazla akis varsa ilki tutulur; kaynak siralamasi
      // genelde ana yayini basa koyar.
      if (!index.has(key)) index.set(key, { url: channel.url, name: channel.name, streamType: channel.streamType });
    }
    return { index, total: channels.length };
  }

  /**
   * Bozuk kanallari kaynaktan tazeler.
   *
   * @param {string} userId
   * @param {string} playlistId
   * @param {object} options
   * @param {string} [options.serverUrl] Verilmezse listenin kayitli kaynagi
   * @param {string[]} [options.channelIds] Acik hedef listesi
   * @param {boolean} [options.onlyDead=true] Yalnizca olu isaretli kanallar
   * @param {boolean} [options.verify=true] Yeni adresi yazmadan once dene
   * @param {boolean} [options.dryRun=false] Yalnizca rapor uret
   */
  async repairFromXtream(userId, playlistId, options = {}) {
    const playlist = await db('playlists').where({ id: playlistId, user_id: userId }).first();
    if (!playlist) throw createAppError('NOT_FOUND', 'Oynatma listesi bulunamadı');

    const credentials = await this._resolveCredentials(playlist, options);
    const targets = await this._targets(playlistId, options);
    if (!targets.length) {
      return {
        checked: 0, repaired: 0, notFound: 0, notWorking: 0,
        note: options.onlyDead === false
          ? 'Listede kanal bulunamadı.'
          : 'Ölü işaretli kanal yok. Önce start_health_scan ile tarama yapın; hiç test edilmemiş kanallar bilerek dışarıda bırakılır.',
      };
    }

    const streamTypes = [...new Set(targets.map((channel) => channel.stream_type || 'live'))];
    const { index, total } = await this._sourceIndex(credentials, streamTypes);

    const candidates = [];
    const notFound = [];
    for (const channel of targets) {
      const match = index.get(matchKey(channel.name));
      if (!match) { notFound.push(channel.name); continue; }
      // Adres zaten ayniysa degistirmek anlamsiz: kanal baska sebeple olu.
      if (match.url === channel.stream_url) { notFound.push(channel.name); continue; }
      candidates.push({ ...channel, newUrl: match.url, sourceName: match.name });
    }

    // Yeni adresi yazmadan once dene: bozuk bir adresi baska bozuk adresle
    // degistirmek listeyi "onarilmis" gosterip sorunu gizler.
    let working = candidates;
    const notWorking = [];
    if (options.verify !== false && candidates.length) {
      const checks = await mapWithConcurrency(candidates, VERIFY_CONCURRENCY,
        (item) => streamHealthService.checkUrl(item.newUrl));
      working = [];
      candidates.forEach((item, position) => {
        if (checks[position]?.ok) working.push(item);
        else notWorking.push(item.name);
      });
    }

    if (options.dryRun === true) {
      return {
        dryRun: true,
        checked: targets.length,
        sourceChannels: total,
        wouldRepair: working.length,
        notFound: notFound.length,
        notWorking: notWorking.length,
        sample: working.slice(0, 20).map((item) => ({ channel: item.name, source: item.sourceName })),
        notFoundSample: notFound.slice(0, 20),
        notWorkingSample: notWorking.slice(0, 20),
      };
    }

    let repaired = 0;
    if (working.length) {
      // Tek sorguda toplu yazim; kanal basina gidis-donus yerine tek tur.
      // Saglik bayraklari sifirlanir ki bir sonraki tarama yeni adresi olcsun.
      const cases = working.map(() => 'WHEN ? THEN ?').join(' ');
      const bindings = working.flatMap((item) => [item.id, item.newUrl]);
      const result = await db.raw(
        `UPDATE channels
            SET stream_url = CASE id ${cases} END,
                last_check_ok = NULL,
                last_checked_at = NULL,
                updated_at = NOW()
          WHERE id = ANY(?::uuid[]) RETURNING id`,
        [...bindings, working.map((item) => item.id)]
      );
      repaired = result.rows.length;
    }

    logger.info({ userId, playlistId, checked: targets.length, repaired, notFound: notFound.length }, 'Stream repair completed');

    return {
      checked: targets.length,
      sourceChannels: total,
      repaired,
      notFound: notFound.length,
      notWorking: notWorking.length,
      verified: options.verify !== false,
      sample: working.slice(0, 10).map((item) => ({ channel: item.name, source: item.sourceName })),
      notFoundSample: notFound.slice(0, 20),
      notWorkingSample: notWorking.slice(0, 20),
      note: repaired
        ? 'Yalnızca akış adresleri değişti; ad, kategori, logo ve EPG eşleşmeleri korundu. Kanallar yeniden test edilmek üzere işaretlendi.'
        : 'Değiştirilecek çalışan karşılık bulunamadı.',
    };
  }
}

module.exports = new StreamRepairService();
module.exports.MAX_TARGETS = MAX_TARGETS;
