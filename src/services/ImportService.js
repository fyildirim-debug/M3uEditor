const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const logger = require('../config/logger');
const XtreamClient = require('./XtreamClient');
const EPGService = require('./EPGService');
const { encrypt, decrypt } = require('../utils/crypto');
const { createAppError } = require('../utils/AppError');

const CHANNEL_BATCH_SIZE = 1000;
const CATEGORY_BATCH_SIZE = 1000;
const DELETE_BATCH_SIZE = 5000;
const VALID_STREAM_TYPES = new Set(['live', 'vod', 'series']);
const PROVIDER_EXTRA_KEYS_SQL = `ARRAY[
  'stream_id', 'stream_type', 'rating', 'genre', 'plot', 'year', 'tmdb_id', 'container_extension'
]::text[]`;

function throwIfCancelled(jobContext) {
  const signal = jobContext?.signal;
  if (!signal?.aborted) return;
  if (signal.reason?.statusCode) throw signal.reason;
  throw createAppError('IMPORT_CANCELLED');
}

class ImportService {
  _normalizeTypes(types) {
    const normalized = [...new Set((Array.isArray(types) ? types : ['live']).filter((type) => VALID_STREAM_TYPES.has(type)))];
    if (!normalized.length) throw createAppError('VALIDATION_ERROR', 'En az bir geçerli içerik türü seçin');
    return normalized;
  }

  async _fetchXtream(credentials, jobContext) {
    throwIfCancelled(jobContext);
    const streamTypes = this._normalizeTypes(credentials.streamTypes);
    const client = new XtreamClient(credentials.serverUrl, credentials.username, credentials.password, {
      signal: jobContext?.signal,
    });
    await client.authenticate();
    throwIfCancelled(jobContext);
    const data = await client.getAllChannels(streamTypes, credentials.categories);
    throwIfCancelled(jobContext);
    return { ...data, client, streamTypes };
  }

  _recordForChannel(playlistId, channel, categoryMap, client, sortOrder) {
    return {
      id: uuidv4(),
      playlist_id: playlistId,
      source_id: String(channel.stream_id),
      name: String(channel.name || 'İsimsiz kanal').slice(0, 500),
      logo_url: channel.stream_icon || null,
      original_logo_url: channel.stream_icon || null,
      stream_url: client.buildStreamUrl(channel.stream_type, channel.stream_id, channel.container_extension || 'ts'),
      epg_channel_id: channel.epg_channel_id || null,
      category_id: channel.category_id ? categoryMap[channel.category_id] || null : null,
      sort_order: sortOrder,
      stream_type: channel.stream_type || 'live',
      original_name: String(channel.name || 'İsimsiz kanal').slice(0, 500),
      extras: JSON.stringify({
        stream_id: channel.stream_id,
        stream_type: channel.stream_type || 'live',
        ...(channel.rating && { rating: channel.rating }),
        ...(channel.genre && { genre: channel.genre }),
        ...(channel.plot && { plot: channel.plot }),
        ...(channel.year && { year: channel.year }),
        ...(channel.tmdb_id && { tmdb_id: channel.tmdb_id }),
        container_extension: channel.container_extension || 'ts',
        metadata_fetched: false,
      }),
    };
  }

  /**
   * Sağlayıcıdan tamamen çekilebilmiş türleri döndürür. Bir tür geçici olarak
   * başarısız olduysa o türe hiç dokunulmaz — aksi halde mevcut kayıtlar
   * "sağlayıcıda yok" sanılıp silinirdi (veri kaybı).
   */
  _completedTypes(types, requestedTypes) {
    if (!Array.isArray(types) || !types.length) return requestedTypes;
    return types.filter((entry) => entry.status === 'complete').map((entry) => entry.type);
  }

  /**
   * Bayat kayıtları tür bazında planlar.
   *
   * Bir türün mevcut kayıtlarının TAMAMINI silecek bir uzlaştırma, sağlayıcının
   * gerçekten o türü boşaltmasından ayırt edilemez (panel arızası da 200 + boş
   * dizi döndürebilir). Bu durumda silme atlanır ve tür raporlanır; kısmi
   * silmeler normal şekilde uygulanır.
   *
   * @param {Array<{ stream_type: string, source_id: string }>} existing
   * @param {Set<string>} fetchedKeys - `${stream_type}:${source_id}` anahtarları
   * @param {string[]} completedTypes
   * @returns {{ stale: Array, skippedTypes: string[] }}
   */
  _planStaleRemovals(existing, fetchedKeys, completedTypes) {
    const existingByType = new Map();
    for (const channel of existing) {
      if (!existingByType.has(channel.stream_type)) existingByType.set(channel.stream_type, []);
      existingByType.get(channel.stream_type).push(channel);
    }

    const stale = [];
    const skippedTypes = [];
    for (const type of completedTypes) {
      const rows = existingByType.get(type);
      if (!rows?.length) continue;

      const staleRows = rows.filter((channel) => !fetchedKeys.has(`${channel.stream_type}:${channel.source_id}`));
      if (staleRows.length === rows.length) {
        skippedTypes.push(type);
        continue;
      }
      stale.push(...staleRows);
    }

    return { stale, skippedTypes };
  }

  _categoryKey(type, categoryId) {
    if (type === 'vod') return `vod_${categoryId}`;
    if (type === 'series') return `series_${categoryId}`;
    return String(categoryId);
  }

  /**
   * Filtrelenmemiş türlerde bütün mevcut kaynak kayıtlarını, filtrelenmiş
   * türlerde ise yalnızca seçilen yerel kategorilerdeki kayıtları yükler.
   * Kategorisiz kayıtlar filtreli sorguya dahil edilmez.
   */
  async _loadExistingChannels(playlistId, completedTypes, scopedCategories, categoryMap, connection) {
    const existing = [];
    const scopedTypes = completedTypes.filter((type) => Object.prototype.hasOwnProperty.call(scopedCategories, type));
    const unscopedTypes = completedTypes.filter((type) => !scopedTypes.includes(type));

    if (unscopedTypes.length) {
      existing.push(...await connection('channels')
        .where({ playlist_id: playlistId })
        .whereIn('stream_type', unscopedTypes)
        .whereNotNull('source_id')
        .select('source_id', 'stream_type'));
    }

    for (const type of scopedTypes) {
      const localCategoryIds = [...new Set(scopedCategories[type]
        .map((categoryId) => categoryMap[this._categoryKey(type, categoryId)])
        .filter(Boolean))];
      if (!localCategoryIds.length) continue;
      existing.push(...await connection('channels')
        .where({ playlist_id: playlistId, stream_type: type })
        .whereIn('category_id', localCategoryIds)
        .whereNotNull('source_id')
        .select('source_id', 'stream_type'));
    }

    return existing;
  }

  async importFromXtream(userId, credentials, onProgress, playlistId, jobContext) {
    const startedAt = Date.now();
    const {
      categories,
      channels,
      client,
      streamTypes,
      types,
      scopedCategories = {},
    } = await this._fetchXtream(credentials, jobContext);
    throwIfCancelled(jobContext);
    const normalizedServerUrl = client.serverUrl;
    const completedTypes = this._completedTypes(types, streamTypes);
    const failedTypes = streamTypes.filter((type) => !completedTypes.includes(type));

    const result = await db.transaction(async (trx) => {
      throwIfCancelled(jobContext);
      let playlist;
      if (playlistId) {
        playlist = await trx('playlists').where({ id: playlistId, user_id: userId }).first();
        if (!playlist) throw createAppError('NOT_FOUND', 'Oynatma listesi bulunamadı');
      } else {
        playlist = await this._getOrCreatePlaylist(userId, credentials, trx);
      }

      await trx('playlists').where({ id: playlist.id }).update({
        xtream_server_url: normalizedServerUrl,
        xtream_username: credentials.username,
        xtream_password_enc: encrypt(credentials.password),
        xtream_stream_types: JSON.stringify(streamTypes),
        updated_at: trx.fn.now(),
      });

      throwIfCancelled(jobContext);
      const categoryMap = await this._upsertCategories(playlist.id, categories, trx, jobContext);
      // Yalnızca eksiksiz çekilebilen türler uzlaştırılır. Kategori filtresi
      // varsa seçilmeyen ve kategorisiz kayıtlar karşılaştırmaya hiç girmez.
      const existing = completedTypes.length
        ? await this._loadExistingChannels(playlist.id, completedTypes, scopedCategories, categoryMap, trx)
        : [];
      const existingKeys = new Set(existing.map((channel) => `${channel.stream_type}:${channel.source_id}`));

      const records = channels.map((channel, index) => this._recordForChannel(playlist.id, channel, categoryMap, client, index));
      await this._bulkUpsertChannels(playlist.id, records, onProgress, trx, jobContext);

      const fetchedKeys = new Set(records.map((channel) => `${channel.stream_type}:${channel.source_id}`));
      const { stale, skippedTypes } = this._planStaleRemovals(existing, fetchedKeys, completedTypes);
      let removed = 0;
      for (let index = 0; index < stale.length; index += DELETE_BATCH_SIZE) {
        throwIfCancelled(jobContext);
        const batch = stale.slice(index, index + DELETE_BATCH_SIZE);
        removed += await trx('channels')
          .where({ playlist_id: playlist.id })
          .whereIn(['stream_type', 'source_id'], batch.map((channel) => [channel.stream_type, channel.source_id]))
          .del();
      }

      // Kısmi senkronizasyon "son senkronizasyon" sayılmaz.
      const playlistUpdate = { updated_at: trx.fn.now() };
      if (!failedTypes.length) playlistUpdate.last_synced_at = trx.fn.now();
      await trx('playlists').where({ id: playlist.id }).update(playlistUpdate);

      const added = records.filter((record) => !existingKeys.has(`${record.stream_type}:${record.source_id}`)).length;
      return {
        playlistId: playlist.id,
        totalChannels: records.length,
        totalCategories: categories.length,
        added,
        updated: records.length - added,
        removed,
        syncedTypes: completedTypes,
        failedTypes,
        scopedCategories,
        skippedRemovalTypes: skippedTypes,
        partial: failedTypes.length > 0,
      };
    });

    if (failedTypes.length) {
      logger.warn({ userId, playlistId: result.playlistId, failedTypes }, 'Xtream import completed partially; failed types were left untouched');
    }

    throwIfCancelled(jobContext);
    this._scheduleEpg(userId, result.playlistId, client.getXmltvUrl());
    return { ...result, duration: Date.now() - startedAt };
  }

  async syncFromXtream(userId, playlistId, onProgress, jobContext) {
    throwIfCancelled(jobContext);
    const playlist = await db('playlists').where({ id: playlistId, user_id: userId }).first();
    throwIfCancelled(jobContext);
    if (!playlist) throw createAppError('NOT_FOUND', 'Oynatma listesi bulunamadı');
    if (!playlist.xtream_server_url || !playlist.xtream_username || !playlist.xtream_password_enc) {
      throw createAppError('VALIDATION_ERROR', 'Bu oynatma listesinde Xtream kaynağı yok');
    }
    const password = decrypt(playlist.xtream_password_enc);
    return this.importFromXtream(userId, {
      serverUrl: playlist.xtream_server_url,
      username: playlist.xtream_username,
      password,
      streamTypes: this._parseStoredTypes(playlist.xtream_stream_types),
    }, onProgress, playlistId, jobContext);
  }

  async addStreamTypes(userId, playlistId, newTypes, jobContext) {
    const startedAt = Date.now();
    throwIfCancelled(jobContext);
    const playlist = await db('playlists').where({ id: playlistId, user_id: userId }).first();
    throwIfCancelled(jobContext);
    if (!playlist) throw createAppError('NOT_FOUND', 'Oynatma listesi bulunamadı');
    if (!playlist.xtream_server_url || !playlist.xtream_username || !playlist.xtream_password_enc) {
      throw createAppError('VALIDATION_ERROR', 'Bu oynatma listesinde Xtream kaynağı yok');
    }

    const existingTypes = this._parseStoredTypes(playlist.xtream_stream_types);
    const typesToAdd = this._normalizeTypes(newTypes).filter((type) => !existingTypes.includes(type));
    if (!typesToAdd.length) throw createAppError('VALIDATION_ERROR', 'Seçilen içerik türleri zaten mevcut');

    const password = decrypt(playlist.xtream_password_enc);
    const { categories, channels, client, types } = await this._fetchXtream({
      serverUrl: playlist.xtream_server_url,
      username: playlist.xtream_username,
      password,
      streamTypes: typesToAdd,
    }, jobContext);

    // Yalnızca eksiksiz çekilebilen türler kalıcı olarak listeye eklenir.
    const completedTypes = this._completedTypes(types, typesToAdd);
    const failedTypes = typesToAdd.filter((type) => !completedTypes.includes(type));

    const added = await db.transaction(async (trx) => {
      throwIfCancelled(jobContext);
      const categoryMap = await this._upsertCategories(playlist.id, categories, trx, jobContext);
      const maxSort = await trx('channels').where({ playlist_id: playlistId }).max('sort_order as max').first();
      const records = channels.map((channel, index) => this._recordForChannel(playlist.id, channel, categoryMap, client, (maxSort?.max ?? -1) + 1 + index));
      const existing = completedTypes.length
        ? await trx('channels').where({ playlist_id: playlistId }).whereIn('stream_type', completedTypes).whereNotNull('source_id').select('source_id', 'stream_type')
        : [];
      const keys = new Set(existing.map((channel) => `${channel.stream_type}:${channel.source_id}`));
      await this._bulkUpsertChannels(playlistId, records, null, trx, jobContext);
      await trx('playlists').where({ id: playlistId }).update({
        xtream_stream_types: JSON.stringify([...new Set([...existingTypes, ...completedTypes])]),
        last_synced_at: trx.fn.now(),
        updated_at: trx.fn.now(),
      });
      return records.filter((record) => !keys.has(`${record.stream_type}:${record.source_id}`)).length;
    });

    if (failedTypes.length) {
      logger.warn({ userId, playlistId, failedTypes }, 'Xtream stream types partially added; failed types were not stored');
    }

    return {
      added,
      totalChannels: channels.length,
      totalCategories: categories.length,
      addedTypes: completedTypes,
      failedTypes,
      partial: failedTypes.length > 0,
      allTypes: [...new Set([...existingTypes, ...completedTypes])],
      duration: Date.now() - startedAt,
    };
  }

  _parseStoredTypes(value) {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      return this._normalizeTypes(parsed);
    } catch {
      return ['live'];
    }
  }

  async _getOrCreatePlaylist(userId, credentials, connection = db) {
    const normalizedUrl = new XtreamClient(credentials.serverUrl, credentials.username, credentials.password).serverUrl;
    let playlist = await connection('playlists').where({ user_id: userId, xtream_server_url: normalizedUrl, xtream_username: credentials.username }).first();
    if (!playlist) {
      [playlist] = await connection('playlists').insert({
        id: uuidv4(),
        user_id: userId,
        name: String(credentials.playlistName || credentials.username).slice(0, 255),
        xtream_server_url: normalizedUrl,
        xtream_username: credentials.username,
        xtream_password_enc: encrypt(credentials.password),
        xtream_stream_types: JSON.stringify(this._normalizeTypes(credentials.streamTypes)),
      }).returning('*');
    }
    return playlist;
  }

  async _upsertCategories(playlistId, categories, connection = db, jobContext) {
    throwIfCancelled(jobContext);
    const categoryMap = {};
    if (!categories.length) return categoryMap;

    const normalized = categories.map((category, index) => ({
      remoteId: category.category_id,
      name: String(category.category_name || 'Kategorisiz').slice(0, 500),
      sortOrder: index,
    }));
    const names = [...new Set(normalized.map((category) => category.name))];
    const rowsByName = new Map();

    for (let index = 0; index < names.length; index += DELETE_BATCH_SIZE) {
      throwIfCancelled(jobContext);
      const existingRows = await connection('categories')
        .where({ playlist_id: playlistId })
        .whereIn('name', names.slice(index, index + DELETE_BATCH_SIZE))
        .select('id', 'name');
      for (const row of existingRows) {
        if (!rowsByName.has(row.name)) rowsByName.set(row.name, row);
      }
    }

    const pendingNames = new Set();
    const rowsToInsert = [];
    for (const category of normalized) {
      if (rowsByName.has(category.name) || pendingNames.has(category.name)) continue;
      const row = {
        id: uuidv4(),
        playlist_id: playlistId,
        name: category.name,
        sort_order: category.sortOrder,
      };
      pendingNames.add(category.name);
      rowsByName.set(category.name, row);
      rowsToInsert.push(row);
    }

    for (let index = 0; index < rowsToInsert.length; index += CATEGORY_BATCH_SIZE) {
      throwIfCancelled(jobContext);
      await connection('categories').insert(rowsToInsert.slice(index, index + CATEGORY_BATCH_SIZE));
    }

    for (const category of normalized) {
      categoryMap[category.remoteId] = rowsByName.get(category.name).id;
    }
    return categoryMap;
  }

  async _bulkUpsertChannels(playlistId, channelRecords, onProgress, connection = db, jobContext) {
    throwIfCancelled(jobContext);
    const uniqueRecords = [...new Map(channelRecords.map((record) => [`${record.stream_type}:${record.source_id || record.stream_url}`, record])).values()];
    // EXCLUDED carries the provider snapshot. Overlay only the existing non-provider keys so
    // application metadata (including future keys) survives sync; replacing extras here used
    // to silently reset metadata_fetched and discard fetched posters, cast, and similar data.
    const mergedExtrasSql = `COALESCE(EXCLUDED.extras, '{}'::jsonb)
          || (COALESCE(channels.extras, '{}'::jsonb) - ${PROVIDER_EXTRA_KEYS_SQL})`;
    const conflictClause = channelRecords.some((record) => record.source_id)
      ? `ON CONFLICT (playlist_id, stream_type, source_id) WHERE source_id IS NOT NULL DO UPDATE SET
          original_name = EXCLUDED.original_name, original_logo_url = EXCLUDED.original_logo_url,
          stream_url = EXCLUDED.stream_url, category_id = EXCLUDED.category_id, sort_order = EXCLUDED.sort_order,
          extras = ${mergedExtrasSql}, updated_at = NOW(),
          epg_channel_id = COALESCE(channels.epg_channel_id, EXCLUDED.epg_channel_id),
          name = CASE WHEN channels.name IS NOT DISTINCT FROM channels.original_name THEN EXCLUDED.name ELSE channels.name END,
          logo_url = CASE WHEN channels.logo_url IS NOT DISTINCT FROM channels.original_logo_url THEN EXCLUDED.logo_url ELSE channels.logo_url END`
      : `ON CONFLICT (playlist_id, stream_url) DO UPDATE SET
          original_name = EXCLUDED.original_name, original_logo_url = EXCLUDED.original_logo_url,
          category_id = EXCLUDED.category_id, sort_order = EXCLUDED.sort_order, extras = ${mergedExtrasSql}, updated_at = NOW(),
          name = CASE WHEN channels.name IS NOT DISTINCT FROM channels.original_name THEN EXCLUDED.name ELSE channels.name END,
          logo_url = CASE WHEN channels.logo_url IS NOT DISTINCT FROM channels.original_logo_url THEN EXCLUDED.logo_url ELSE channels.logo_url END`;

    for (let index = 0; index < uniqueRecords.length; index += CHANNEL_BATCH_SIZE) {
      throwIfCancelled(jobContext);
      const batch = uniqueRecords.slice(index, index + CHANNEL_BATCH_SIZE);
      const { sql, bindings } = connection('channels').insert(batch).toSQL();
      await connection.raw(`${sql} ${conflictClause}`, bindings);
      onProgress?.({ processed: Math.min(index + CHANNEL_BATCH_SIZE, uniqueRecords.length), total: uniqueRecords.length });
    }
  }

  async importFromM3U(userId, m3uContent, playlistId, playlistName, jobContext) {
    const startedAt = Date.now();
    throwIfCancelled(jobContext);
    const M3UParser = require('../parsers/M3UParser');
    const { channels } = new M3UParser().parse(m3uContent);
    if (!channels.length) throw createAppError('VALIDATION_ERROR', 'M3U içeriğinde kanal bulunamadı');

    const result = await db.transaction(async (trx) => {
      throwIfCancelled(jobContext);
      let playlist;
      if (playlistId) playlist = await trx('playlists').where({ id: playlistId, user_id: userId }).first();
      else [playlist] = await trx('playlists').insert({ id: uuidv4(), user_id: userId, name: String(playlistName || 'M3U İçeri Aktarımı').slice(0, 255) }).returning('*');
      if (!playlist) throw createAppError('NOT_FOUND', 'Oynatma listesi bulunamadı');

      const groups = [...new Set(channels.map((channel) => channel.group).filter(Boolean))];
      const categoryMap = await this._upsertCategories(
        playlist.id,
        groups.map((name, index) => ({ category_id: String(index), category_name: name })),
        trx,
        jobContext
      );
      const groupIds = Object.fromEntries(groups.map((name, index) => [name, categoryMap[String(index)]]));
      const records = channels.map((channel, index) => ({
        id: uuidv4(), playlist_id: playlist.id, source_id: null,
        name: String(channel.name || 'İsimsiz kanal').slice(0, 500), original_name: String(channel.name || 'İsimsiz kanal').slice(0, 500),
        logo_url: channel.logo || null, original_logo_url: channel.logo || null, stream_url: channel.url,
        epg_channel_id: channel.epgId || null, category_id: channel.group ? groupIds[channel.group] || null : null,
        sort_order: index, stream_type: 'live', extras: JSON.stringify(channel.extras || {}),
      }));
      await this._bulkUpsertChannels(playlist.id, records, null, trx, jobContext);
      return { playlistId: playlist.id, totalChannels: records.length, totalCategories: groups.length };
    });
    return { ...result, duration: Date.now() - startedAt };
  }

  _scheduleEpg(userId, playlistId, url) {
    const service = new EPGService();
    service.enqueueSource(userId, url, playlistId).catch((error) => {
      logger.warn({ err: error, userId, playlistId }, 'Background EPG refresh failed');
    });
  }
}

module.exports = ImportService;
