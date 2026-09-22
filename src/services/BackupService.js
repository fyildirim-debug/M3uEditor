const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const db = require('../config/database');
const logger = require('../config/logger');
const { createAppError } = require('../utils/AppError');

/** Ayni playlist'te tutulacak maksimum yedek sayisi */
const RETENTION_LIMIT = 10;
/** Toplu kanal insert'inde chunk boyutu */
const INSERT_CHUNK = 500;
/** Gecerli yedek nedenleri */
const VALID_REASONS = new Set(['manual', 'pre-sync', 'scheduled', 'ai-task']);
// Gece calisan asistan gorevleri her turda yedek alir. Ortak bir kotada
// tutulsalardi birkac gunde kullanicinin elle aldigi yedekleri disari iterlerdi;
// bu yuzden gorev yedekleri kendi kotasinda sayilir.
const AI_TASK_REASON = 'ai-task';
const SETTINGS_FIELDS = ['xtream_server_url', 'xtream_username', 'xtream_password_enc', 'xtream_stream_types', 'sync_interval_minutes', 'backup_before_sync', 'last_synced_at'];
const RELATED_TABLES = ['playlist_sources', 'filter_rules', 'playlist_views', 'epg_match_profiles'];

/** Yedegi olusturan kanal alanlari (sirasiz diger kolonlar haric) */
const CHANNEL_FIELDS = [
  'id',
  'xtream_id',
  'name',
  'original_name',
  'logo_url',
  'original_logo_url',
  'stream_url',
  'epg_channel_id',
  'epg_source_id',
  'category_id',
  'sort_order',
  'stream_type',
  'source_id',
  'extras',
];

class BackupService {
  /** Yedek dosyalarinin kok dizini: <uploadDir>/backups */
  rootDir() {
    return path.join(path.dirname(config.uploadDir), 'backups');
  }

  /** Playlist'e ait yedek dizini */
  playlistDir(playlistId) {
    return path.join(this.rootDir(), String(playlistId));
  }

  /**
   * Playlist sahipligini dogrular; yoksa NOT_FOUND firlatir.
   * @returns {Promise<object>} playlist satiri
   */
  async assertPlaylistOwnership(userId, playlistId, trx = db) {
    const playlist = await trx('playlists')
      .where({ id: playlistId, user_id: userId })
      .first('id', 'user_id', 'name');
    if (!playlist) {
      throw createAppError('NOT_FOUND', 'Oynatma listesi bulunamadı');
    }
    return playlist;
  }

  /**
   * Yedegin sahipligini dogrular; yoksa NOT_FOUND firlatir.
   * @returns {Promise<object>} backups satiri
   */
  async assertBackupOwnership(userId, backupId) {
    const backup = await db('backups')
      .where({ id: backupId, user_id: userId })
      .first();
    if (!backup) {
      throw createAppError('NOT_FOUND', 'Yedek bulunamadı');
    }
    return backup;
  }

  /**
   * Playlist'in tam snapshot'ini gzip'li JSON olarak diske yazar ve
   * backups tablosuna metadata kaydi ekler. Retention: playlist basina
   * son RETENTION_LIMIT yedek tutulur, eskileri dosya+satir olarak silinir.
   *
   * @param {string} userId
   * @param {string} playlistId
   * @param {'manual'|'pre-sync'|'scheduled'} reason
   * @returns {Promise<object>} olusturulan backups satiri
   */
  async createBackup(userId, playlistId, reason = 'manual') {
    const playlist = await this.assertPlaylistOwnership(userId, playlistId);
    const safeReason = VALID_REASONS.has(reason) ? reason : 'manual';

    const [categories, channels, settings, relatedRows] = await db.transaction(async (trx) => {
      await trx.raw('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      const categories = await trx('categories')
        .where({ playlist_id: playlistId })
        .select('id', 'xtream_id', 'name', 'sort_order', 'is_hidden')
        .orderBy('sort_order', 'asc');
      const channels = await trx('channels')
        .where({ playlist_id: playlistId })
        .select(CHANNEL_FIELDS)
        .orderBy('sort_order', 'asc');
      const settings = await trx('playlists').where({ id: playlistId, user_id: userId }).first(SETTINGS_FIELDS);
      const relatedRows = [];
      for (const table of RELATED_TABLES) relatedRows.push(await trx(table).where({ playlist_id: playlistId }).select('*'));
      return [categories, channels, settings, relatedRows];
    });

    const payload = {
      version: 2,
      created_at: new Date().toISOString(),
      playlist: { id: playlist.id, name: playlist.name },
      categories,
      channels,
      settings,
      related: Object.fromEntries(RELATED_TABLES.map((table, index) => [table, relatedRows[index]])),
    };

    const dir = this.playlistDir(playlistId);
    await fsp.mkdir(dir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${stamp}-${uuidv4().slice(0, 8)}.json.gz`;
    const filePath = path.join(dir, fileName);
    const gzipped = await gzip(Buffer.from(JSON.stringify(payload), 'utf8'));
    await fsp.writeFile(filePath, gzipped);

    // filename kolonu uploadDir'e gore goreli yol tutar
    const relativeName = path.join('backups', String(playlistId), fileName);

    const [row] = await db('backups')
      .insert({
        id: uuidv4(),
        playlist_id: playlistId,
        user_id: userId,
        filename: relativeName,
        playlist_name: playlist.name,
        channel_count: channels.length,
        category_count: categories.length,
        size_bytes: gzipped.length,
        reason: safeReason,
      })
      .returning('*');

    await this.enforceRetention(playlistId);
    return row;
  }

  /**
   * Playlist basina son RETENTION_LIMIT yedegi tutar; daha eski yedeklerin
   * dosyasini ve veritabani satirini siler.
   * @param {string} playlistId
   */
  async enforceRetention(playlistId) {
    // Iki ayri kova: kullanicinin yedekleri ve asistan gorevlerinin yedekleri.
    // Her biri kendi icinde son RETENTION_LIMIT kaydi tutar.
    const stale = [];
    for (const aiTask of [false, true]) {
      const rows = await db('backups')
        .where({ playlist_id: playlistId })
        .andWhere((query) => (aiTask
          ? query.where('reason', AI_TASK_REASON)
          : query.whereNot('reason', AI_TASK_REASON)))
        .orderBy('created_at', 'desc')
        .offset(RETENTION_LIMIT)
        .select('id', 'filename');
      stale.push(...rows);
    }

    for (const backup of stale) {
      await this.removeBackupFile(backup.filename);
    }
    if (stale.length > 0) {
      await db('backups').whereIn('id', stale.map((b) => b.id)).del();
    }
  }

  /**
   * Kullanicinin bir playlist'ine ait yedekleri listeler (yeniden eskiye).
   * @param {string} userId
   * @param {string} playlistId
   * @returns {Promise<object[]>}
   */
  async listBackups(userId, playlistId) {
    await this.assertPlaylistOwnership(userId, playlistId);
    return db('backups')
      .where({ playlist_id: playlistId, user_id: userId })
      .select('id', 'playlist_id', 'playlist_name', 'channel_count', 'category_count', 'size_bytes', 'reason', 'created_at')
      .orderBy('created_at', 'desc');
  }

  /**
   * Yedegin diskteki mutlak yolunu ve indirilecek dosya adini dondurur.
   * @param {string} userId
   * @param {string} backupId
   * @returns {Promise<{ filePath: string, downloadName: string, backup: object }>}
   */
  async getBackupFile(userId, backupId) {
    const backup = await this.assertBackupOwnership(userId, backupId);
    const filePath = await this.migrateLegacyFile(backup.filename);
    if (!fs.existsSync(filePath)) {
      throw createAppError('NOT_FOUND', 'Yedek dosyası diskte bulunamadı');
    }
    const baseName = `${backup.playlist_name.replace(/[^\p{L}\p{N}\- ]+/gu, '').trim() || 'playlist'}-yedek-${backup.created_at.toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json.gz`;
    return { filePath, downloadName: baseName, backup };
  }

  /**
   * Yedegi siler (dosya + veritabani satiri).
   * @param {string} userId
   * @param {string} backupId
   */
  async deleteBackup(userId, backupId) {
    const backup = await this.assertBackupOwnership(userId, backupId);
    await this.removeBackupFile(backup.filename);
    await db('backups').where({ id: backup.id }).del();
  }

  /**
   * Yedegi geri yukler.
   * - targetPlaylistId verilirse: o playlist'in mevcut kanallari/kategorileri
   *   silinir ve yedek uzerine yazilir (playlist adi korunur).
   * - Verilmezse: yeni bir playlist olusturulur.
   * Kategori eslesmesi isim uzerinden yapilir; yeni kategori id'leri uretilir
   * ve eski category_id -> yeni id map'i kurulur. Tum DB islemleri tek
   * transaction icindedir.
   *
   * @param {string} userId
   * @param {string} backupId
   * @param {string|null} targetPlaylistId
   * @returns {Promise<{ playlistId: string, name: string, channelCount: number, categoryCount: number, overwritten: boolean }>}
   */
  async restoreBackup(userId, backupId, targetPlaylistId = null, connection = db) {
    const backup = await this.assertBackupOwnership(userId, backupId);

    const filePath = await this.migrateLegacyFile(backup.filename);
    let raw;
    try {
      raw = await fsp.readFile(filePath);
    } catch {
      throw createAppError('NOT_FOUND', 'Yedek dosyası diskte bulunamadı');
    }

    let payload;
    try {
      payload = JSON.parse((await gunzip(raw, { maxOutputLength: 256 * 1024 * 1024 })).toString('utf8'));
    } catch {
      throw createAppError('VALIDATION_ERROR', 'Yedek dosyası bozuk veya okunamıyor');
    }
    if (!payload || !Array.isArray(payload.channels) || !Array.isArray(payload.categories)) {
      throw createAppError('VALIDATION_ERROR', 'Yedek dosyası geçersiz formatta');
    }

    // EPG kaynak referanslari yalnizca kullanicinin hala var olan
    // kaynaklarina isaret edebilir; silinmis olanlar null'a cekilir.
    const validEpgSourceIds = new Set(
      await connection('epg_sources').where({ user_id: userId }).pluck('id')
    );

    return connection.transaction(async (trx) => {
      let playlist;
      let overwritten = false;

      if (targetPlaylistId) {
        await trx('playlists').where({ id: targetPlaylistId, user_id: userId }).forUpdate().first('id');
        playlist = await this.assertPlaylistOwnership(userId, targetPlaylistId, trx);
        // Mevcut icerigi temizle (channels -> categories sirasi FK icin onemli)
        await trx('channels').where({ playlist_id: playlist.id }).del();
        await trx('categories').where({ playlist_id: playlist.id }).del();
        overwritten = true;
      } else {
        const restoredName = `${(payload.playlist && payload.playlist.name) || backup.playlist_name} (Geri Yükleme)`.slice(0, 255);
        const [created] = await trx('playlists')
          .insert({ id: uuidv4(), user_id: userId, name: restoredName })
          .returning(['id', 'name']);
        playlist = created;
      }

      // Kategorileri yeni id'lerle olustur, eski id -> yeni id map'i kur
      const categoryIdMap = new Map();
      if (payload.categories.length > 0) {
        const categoryRows = payload.categories.map((cat) => {
          const newId = targetPlaylistId === payload.playlist?.id ? cat.id : uuidv4();
          categoryIdMap.set(cat.id, newId);
          return {
            id: newId,
            ...(targetPlaylistId === payload.playlist?.id && cat.xtream_id ? { xtream_id: cat.xtream_id } : {}),
            playlist_id: playlist.id,
            name: String(cat.name || 'Kategori').slice(0, 255),
            sort_order: Number.isInteger(cat.sort_order) ? cat.sort_order : 0,
            is_hidden: cat.is_hidden === true,
          };
        });
        await trx('categories').insert(categoryRows);
      }

      // Kanallari yeni id'lerle ve map'lenmis kategori referanslariyla ekle
      if (payload.channels.length > 0) {
        const channelRows = payload.channels.map((ch, index) => ({
          id: targetPlaylistId === payload.playlist?.id ? ch.id : uuidv4(),
          ...(targetPlaylistId === payload.playlist?.id && ch.xtream_id ? { xtream_id: ch.xtream_id } : {}),
          playlist_id: playlist.id,
          category_id: ch.category_id && categoryIdMap.has(ch.category_id) ? categoryIdMap.get(ch.category_id) : null,
          name: String(ch.name || 'Kanal'),
          original_name: ch.original_name != null ? String(ch.original_name) : null,
          logo_url: ch.logo_url != null ? String(ch.logo_url) : null,
          original_logo_url: ch.original_logo_url != null ? String(ch.original_logo_url) : null,
          stream_url: String(ch.stream_url || ''),
          epg_channel_id: ch.epg_channel_id != null ? String(ch.epg_channel_id) : null,
          epg_source_id: ch.epg_source_id && validEpgSourceIds.has(ch.epg_source_id) ? ch.epg_source_id : null,
          sort_order: Number.isInteger(ch.sort_order) ? ch.sort_order : index,
          stream_type: typeof ch.stream_type === 'string' && ch.stream_type ? ch.stream_type.slice(0, 20) : 'live',
          source_id: ch.source_id != null ? String(ch.source_id) : null,
          extras: ch.extras && typeof ch.extras === 'object' ? ch.extras : null,
        })).filter((ch) => ch.stream_url.length > 0);

        for (let i = 0; i < channelRows.length; i += INSERT_CHUNK) {
          await trx('channels').insert(channelRows.slice(i, i + INSERT_CHUNK));
        }
      }

      if (payload.version >= 2 && payload.related) {
        for (const table of RELATED_TABLES) {
          if (!Array.isArray(payload.related[table])) continue;
          await trx(table).where({ playlist_id: playlist.id }).del();
          const rows = payload.related[table].map(row => {
            const restored = { ...row, id: targetPlaylistId === payload.playlist?.id ? row.id : uuidv4(), playlist_id: playlist.id };
            if (table === 'playlist_views') {
              const ids = typeof row.hidden_category_ids === 'string' ? JSON.parse(row.hidden_category_ids) : row.hidden_category_ids;
              restored.hidden_category_ids = JSON.stringify((ids || []).map(id => categoryIdMap.get(id)).filter(Boolean));
            }
            return restored;
          });
          for (let i = 0; i < rows.length; i += INSERT_CHUNK) await trx(table).insert(rows.slice(i, i + INSERT_CHUNK));
        }
      }
      const settings = {};
      if (payload.settings && typeof payload.settings === 'object') {
        for (const key of SETTINGS_FIELDS) {
          if (Object.hasOwn(payload.settings, key)) settings[key] = payload.settings[key];
        }
        // Copying a snapshot must not start unattended jobs on the new list.
        if (targetPlaylistId !== payload.playlist?.id) settings.sync_interval_minutes = null;
      }
      await trx('playlists').where({ id: playlist.id }).update({ ...settings, updated_at: trx.fn.now() });

      return {
        playlistId: playlist.id,
        name: playlist.name,
        channelCount: payload.channels.length,
        categoryCount: payload.categories.length,
        overwritten,
      };
    });
  }

  /**
   * Playlist silindiginde yedek dizinini de temizler.
   * PlaylistService.delete tarafindan cagrilir.
   * @param {string} playlistId
   */
  async removePlaylistBackupDir(playlistId) {
    try {
      await fsp.rm(this.playlistDir(playlistId), { recursive: true, force: true });
      await fsp.rm(path.join(config.uploadDir, 'backups', String(playlistId)), { recursive: true, force: true });
    } catch (err) {
      logger.warn({ err, playlistId }, 'Yedek dizini silinemedi');
    }
  }

  /** uploadDir-alti goreli yolu guvenli sekilde mutlak yola cevirir */
  resolveBackupPath(relativeName) {
    const resolved = path.resolve(path.dirname(config.uploadDir), String(relativeName));
    const root = path.resolve(this.rootDir());
    if (!resolved.startsWith(root + path.sep)) {
      throw createAppError('VALIDATION_ERROR', 'Geçersiz yedek dosya yolu');
    }
    return resolved;
  }

  async migrateLegacyFile(relativeName) {
    const destination = this.resolveBackupPath(relativeName);
    const legacyRoot = path.resolve(config.uploadDir, 'backups');
    const legacy = path.resolve(config.uploadDir, String(relativeName));
    if (!legacy.startsWith(legacyRoot + path.sep)) throw createAppError('VALIDATION_ERROR', 'Geçersiz yedek dosya yolu');
    try {
      await fsp.access(destination);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await fsp.mkdir(path.dirname(destination), { recursive: true });
      try { await fsp.rename(legacy, destination); } catch (moveError) {
        if (moveError.code !== 'ENOENT') throw moveError;
      }
    }
    return destination;
  }

  /** Yedek dosyasini diskten siler; yoksa sessizce gecer */
  async removeBackupFile(relativeName) {
    try {
      await fsp.unlink(await this.migrateLegacyFile(relativeName));
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.warn({ err, relativeName }, 'Yedek dosyası silinemedi');
      }
    }
  }
}

module.exports = new BackupService();
