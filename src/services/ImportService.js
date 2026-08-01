const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const logger = require('../config/logger');
const XtreamClient = require('./XtreamClient');
const EPGService = require('./EPGService');
const FilterRuleService = require('./FilterRuleService');
const { encrypt, decrypt } = require('../utils/crypto');
const { createAppError } = require('../utils/AppError');

const CHANNEL_BATCH_SIZE = 1000;
const CATEGORY_BATCH_SIZE = 1000;
const DELETE_BATCH_SIZE = 5000;
const VALID_STREAM_TYPES = new Set(['live', 'vod', 'series']);
const filterRuleService = new FilterRuleService();
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

  /**
   * @param {Object<string,string>} [categoryNames] - uzak kategori_id -> kategori adi;
   *   kayda gecici `category_name` alani ekler (filtre kurallari 'group' eslesmesi icin,
   *   DB'ye yazilmaz — FilterRuleService uygulama sonrasi temizler).
   */
  _recordForChannel(playlistId, channel, categoryMap, client, sortOrder, categoryNames) {
    const record = {
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
    // Gecici alan: yalnizca kategori adlari verildiginde eklenir (filtre kurallari icin)
    if (categoryNames) {
      record.category_name = channel.category_id != null ? categoryNames[String(channel.category_id)] ?? null : null;
    }
    return record;
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

  /**
   * @param {object} [options]
   * @param {boolean} [options.persistCredentials=true] - false ise playlists.xtream_*
   *   kimlik kolonlarina dokunulmaz (ek kaynak senkronu; ana kaynak korunur).
   * @param {boolean} [options.reconcile=true] - false ise bayat kayit silme atlanir ve
   *   sonuca `fetchedKeys`/`scopedLocal` eklenir; cagiran (syncAllSources) tum kaynaklar
   *   bitince birlesik uzlastirma yapar.
   */
  async importFromXtream(userId, credentials, onProgress, playlistId, jobContext, options = {}) {
    const persistCredentials = options.persistCredentials !== false;
    const reconcile = options.reconcile !== false;
    const startedAt = Date.now();
    const reportProgress = onProgress || jobContext?.onProgress;
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

      if (persistCredentials) {
        await trx('playlists').where({ id: playlist.id }).update({
          xtream_server_url: normalizedServerUrl,
          xtream_username: credentials.username,
          xtream_password_enc: encrypt(credentials.password),
          xtream_stream_types: JSON.stringify(streamTypes),
          updated_at: trx.fn.now(),
        });
      }

      throwIfCancelled(jobContext);
      const { map: categoryMap, addedNames: addedCategories } = await this._upsertCategories(playlist.id, categories, trx, jobContext);
      // Yalnızca eksiksiz çekilebilen türler uzlaştırılır. Kategori filtresi
      // varsa seçilmeyen ve kategorisiz kayıtlar karşılaştırmaya hiç girmez.
      const existing = completedTypes.length
        ? await this._loadExistingChannels(playlist.id, completedTypes, scopedCategories, categoryMap, trx)
        : [];
      const existingKeys = new Set(existing.map((channel) => `${channel.stream_type}:${channel.source_id}`));

      const categoryNames = Object.fromEntries(categories.map((category) => [String(category.category_id), String(category.category_name || '')]));
      let records = channels.map((channel, index) => this._recordForChannel(playlist.id, channel, categoryMap, client, index, categoryNames));
      // Filtre kurallari upsert ONCESI uygulanir; haric tutulan kayitlar DB'ye hic girmez
      // ve bayat-kayit uzlastirmasinda 'saglayicida yok' sayilir (sonraki sync'te silinir).
      const filterResult = await filterRuleService.applyForPlaylist(playlist.id, records, trx);
      records = filterResult.records;
      const filteredOut = filterResult.filteredOut;
      await this._bulkUpsertChannels(playlist.id, records, onProgress, trx, jobContext);

      const fetchedKeys = new Set(records.map((channel) => `${channel.stream_type}:${channel.source_id}`));
      let stale = [];
      let skippedTypes = [];
      if (reconcile) {
        ({ stale, skippedTypes } = this._planStaleRemovals(existing, fetchedKeys, completedTypes));
      }
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
      const addedChannelNames = records
        .filter((record) => !existingKeys.has(`${record.stream_type}:${record.source_id}`))
        .slice(0, 20)
        .map((record) => record.name);
      return {
        playlistId: playlist.id,
        totalChannels: records.length,
        totalCategories: categories.length,
        added,
        addedCategories,
        addedChannelNames,
        updated: records.length - added,
        removed,
        filteredOut,
        syncedTypes: completedTypes,
        failedTypes,
        scopedCategories,
        skippedRemovalTypes: skippedTypes,
        partial: failedTypes.length > 0,
        // Birlesik uzlastirma icin (yalnizca reconcile=false iken tasinir; HTTP
        // yanitina syncAllSources tarafindan dahil edilmez)
        ...(reconcile ? {} : {
          fetchedKeys,
          scopedLocal: this._scopedLocalCategories(completedTypes, scopedCategories, categoryMap),
        }),
      };
    });

    if (failedTypes.length) {
      logger.warn({ userId, playlistId: result.playlistId, failedTypes }, 'Xtream import completed partially; failed types were left untouched');
    }

    throwIfCancelled(jobContext);
    this._scheduleEpg(userId, result.playlistId, client.getXmltvUrl());
    return { ...result, duration: Date.now() - startedAt };
  }

  async syncFromXtream(userId, playlistId, onProgress, jobContext, options = {}) {
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
      categories: options.categories,
    }, onProgress, playlistId, jobContext);
  }

  /**
   * Bir kaynak senkronunun kategori kapsamini yerel kategori kimliklerine cozer.
   * Tur bazinda: kapsamliysa yerel kategori id dizisi, kapsamsizsa null.
   */
  _scopedLocalCategories(completedTypes, scopedCategories, categoryMap) {
    const scopedLocal = {};
    for (const type of completedTypes) {
      const remoteIds = scopedCategories[type];
      scopedLocal[type] = remoteIds
        ? [...new Set(remoteIds.map((id) => categoryMap[this._categoryKey(type, id)]).filter(Boolean))]
        : null;
    }
    return scopedLocal;
  }

  /**
   * sync-all icin kaynagin secili kategorilerini hesaplar: previewSync ile ayni
   * mantik — saglayici kategorilerinden yerelde ayni adla var olanlar secilir
   * (vod/series on ekli adlarla da eslesir). Playlist henuz bos ise veya kaynakla
   * hic ad ortusmesi yoksa kisit uygulanmaz (kaynak 'yeni' sayilir, tam cekilir).
   * Hic eslesmeyen turler o kaynak icin cekilmez ki kaynak playlist'e takip
   * edilmeyen devasa turler dokmeyin.
   */
  async _selectedCategoriesForSource(source, playlistId, streamTypes, jobContext) {
    throwIfCancelled(jobContext);
    const client = new XtreamClient(source.serverUrl, source.username, source.password, {
      signal: jobContext?.signal,
    });
    const preview = await client.preview();
    throwIfCancelled(jobContext);

    const localNames = new Set(
      (await db('categories').where({ playlist_id: playlistId }).select('name')).map((row) => row.name)
    );
    if (!localNames.size) return { categories: undefined, streamTypes };

    const PREFIX_BY_TYPE = { vod: 'VOD | ', series: 'Series | ' };
    const selection = {};
    const types = [];
    for (const type of streamTypes) {
      const typeData = preview.types[type];
      if (!typeData?.available) continue;
      const prefix = PREFIX_BY_TYPE[type] || '';
      const matched = typeData.categories
        .filter((category) => localNames.has(category.name) || localNames.has(prefix + category.name))
        .map((category) => category.id);
      if (matched.length) {
        selection[type] = matched;
        types.push(type);
      }
    }
    if (!types.length) return { categories: undefined, streamTypes };
    return { categories: selection, streamTypes: types };
  }

  /**
   * Coklu kaynakli sync'in birlesik bayat-kayit uzlastirmasi. Bir kayit ancak
   * turunu TAMAMLAMIS tum kaynaklarin birlesiminde yoksa bayat sayilir; bir
   * kaynak bir turu cekemediyse o tur icin hic silme yapilmaz (veri kaybini
   * onler). Kategori kapsami kaynaklar arasinda birlestririlir.
   */
  async _reconcileSources(playlistId, sourcesData, jobContext) {
    const empty = { removed: 0, skippedRemovalTypes: [] };
    if (!sourcesData.length) return empty;
    const reconciledTypes = ['live', 'vod', 'series']
      .filter((type) => sourcesData.every((data) => data.completedTypes.includes(type)));
    if (!reconciledTypes.length) return empty;

    const mergedScope = {};
    for (const type of reconciledTypes) {
      mergedScope[type] = sourcesData.some((data) => !data.scopedLocal || data.scopedLocal[type] == null)
        ? null
        : [...new Set(sourcesData.flatMap((data) => data.scopedLocal[type]))];
    }
    const fetchedKeys = new Set();
    for (const data of sourcesData) {
      for (const key of data.fetchedKeys) fetchedKeys.add(key);
    }

    return db.transaction(async (trx) => {
      const existing = [];
      const unscopedTypes = reconciledTypes.filter((type) => mergedScope[type] === null);
      const scopedTypes = reconciledTypes.filter((type) => mergedScope[type] !== null);
      if (unscopedTypes.length) {
        existing.push(...await trx('channels')
          .where({ playlist_id: playlistId })
          .whereIn('stream_type', unscopedTypes)
          .whereNotNull('source_id')
          .select('source_id', 'stream_type'));
      }
      for (const type of scopedTypes) {
        if (!mergedScope[type].length) continue;
        existing.push(...await trx('channels')
          .where({ playlist_id: playlistId, stream_type: type })
          .whereIn('category_id', mergedScope[type])
          .whereNotNull('source_id')
          .select('source_id', 'stream_type'));
      }
      const { stale, skippedTypes } = this._planStaleRemovals(existing, fetchedKeys, reconciledTypes);
      let removed = 0;
      for (let index = 0; index < stale.length; index += DELETE_BATCH_SIZE) {
        throwIfCancelled(jobContext);
        const batch = stale.slice(index, index + DELETE_BATCH_SIZE);
        removed += await trx('channels')
          .where({ playlist_id: playlistId })
          .whereIn(['stream_type', 'source_id'], batch.map((channel) => [channel.stream_type, channel.source_id]))
          .del();
      }
      return { removed, skippedRemovalTypes: skippedTypes };
    });
  }

  /**
   * Ana kaynak + playlist_sources'taki tum ek kaynaklari sirayla senkronize eder.
   * Kategoriler _upsertCategories'in isim bazli birlestirmesi sayesinde dogal
   * olarak tek kategoride toplanir (ayni adli kategoriler = dogal dedupe).
   * Kaynak bazli hatalar diger kaynaklari durdurmaz; rapor birlesiktir.
   */
  async syncAllSources(userId, playlistId, onProgress, jobContext) {
    const startedAt = Date.now();
    throwIfCancelled(jobContext);
    const playlist = await db('playlists').where({ id: playlistId, user_id: userId }).first();
    if (!playlist) throw createAppError('NOT_FOUND', 'Oynatma listesi bulunamadı');

    const extraSources = await db('playlist_sources')
      .where({ playlist_id: playlistId })
      .orderBy('position', 'asc')
      .orderBy('created_at', 'asc');

    const sources = [];
    if (playlist.xtream_server_url && playlist.xtream_username && playlist.xtream_password_enc) {
      sources.push({
        sourceId: null,
        label: null,
        serverUrl: playlist.xtream_server_url,
        username: playlist.xtream_username,
        password: decrypt(playlist.xtream_password_enc),
        persistCredentials: true,
        // Ana kaynak hic senkronize edilmediyse tam cekim (kategori kisiti yok)
        fresh: !playlist.last_synced_at,
      });
    }
    for (const row of extraSources) {
      sources.push({
        sourceId: row.id,
        label: row.label,
        serverUrl: row.server_url,
        username: row.username,
        password: decrypt(row.password_enc),
        persistCredentials: false,
        fresh: !row.last_synced_at,
      });
    }
    if (!sources.length) {
      throw createAppError('VALIDATION_ERROR', 'Bu oynatma listesinde senkronize edilecek Xtream kaynağı yok');
    }

    const storedTypes = this._parseStoredTypes(playlist.xtream_stream_types);
    const results = [];
    const reconData = [];
    for (const source of sources) {
      throwIfCancelled(jobContext);
      const label = source.label || `${source.username}@${source.serverUrl}`;
      try {
        // Hic senkronize edilmemis kaynak tam cekilir; aksi halde yalnizca yerelde
        // karsiligi olan kategoriler (previewSync 'secili' mantigi) guncellenir.
        const scope = source.fresh
          ? { categories: undefined, streamTypes: storedTypes }
          : await this._selectedCategoriesForSource(source, playlistId, storedTypes, jobContext);
        const result = await this.importFromXtream(userId, {
          serverUrl: source.serverUrl,
          username: source.username,
          password: source.password,
          streamTypes: scope.streamTypes,
          categories: scope.categories,
        }, onProgress, playlistId, jobContext, {
          persistCredentials: source.persistCredentials,
          reconcile: false,
        });
        if (source.sourceId && !result.failedTypes.length) {
          await db('playlist_sources').where({ id: source.sourceId }).update({ last_synced_at: db.fn.now() });
        }
        reconData.push({
          completedTypes: result.syncedTypes,
          fetchedKeys: result.fetchedKeys,
          scopedLocal: result.scopedLocal,
        });
        results.push({
          sourceId: source.sourceId,
          label,
          ok: true,
          added: result.added,
          updated: result.updated,
          totalChannels: result.totalChannels,
          filteredOut: result.filteredOut,
          failedTypes: result.failedTypes,
          partial: result.partial,
        });
      } catch (error) {
        if (error?.code === 'IMPORT_CANCELLED') throw error;
        logger.warn({ err: error, userId, playlistId, source: label }, 'Multi-source sync: source failed, continuing with next source');
        results.push({
          sourceId: source.sourceId,
          label,
          ok: false,
          error: error?.message || 'Kaynak senkronize edilemedi',
        });
      }
    }

    const { removed, skippedRemovalTypes } = await this._reconcileSources(playlistId, reconData, jobContext);
    const successful = results.filter((entry) => entry.ok);
    return {
      playlistId,
      sources: results,
      added: successful.reduce((sum, entry) => sum + entry.added, 0),
      updated: successful.reduce((sum, entry) => sum + entry.updated, 0),
      totalChannels: successful.reduce((sum, entry) => sum + entry.totalChannels, 0),
      filteredOut: successful.reduce((sum, entry) => sum + entry.filteredOut, 0),
      removed,
      skippedRemovalTypes,
      syncedSources: successful.length,
      failedSources: results.length - successful.length,
      partial: results.some((entry) => !entry.ok || entry.partial),
      duration: Date.now() - startedAt,
    };
  }

  /**
   * Guncelleme oncesi kategori secimi icin saglayici kategorilerini ceker.
   * Her kategori, yerelde ayni adli kategori varsa 'selected' (onceki secim),
   * yoksa 'isNew' (saglayiciya yeni gelmis) olarak isaretlenir. Eslesme,
   * _upsertCategories ile ayni sekilde ad uzerinden yapilir.
   */
  async previewSync(userId, playlistId) {
    const playlist = await db('playlists').where({ id: playlistId, user_id: userId }).first();
    if (!playlist) throw createAppError('NOT_FOUND', 'Oynatma listesi bulunamadı');
    if (!playlist.xtream_server_url || !playlist.xtream_username || !playlist.xtream_password_enc) {
      throw createAppError('VALIDATION_ERROR', 'Bu oynatma listesinde Xtream kaynağı yok');
    }
    const password = decrypt(playlist.xtream_password_enc);
    const client = new XtreamClient(playlist.xtream_server_url, playlist.xtream_username, password);
    const preview = await client.preview();

    const localNames = new Set(
      (await db('categories').where({ playlist_id: playlistId }).select('name')).map((row) => row.name)
    );
    // Import vod/series kategorilerini canli ile cakismamasi icin on ekli kaydeder
    // ("VOD | X", "Series | X"); eslesme on ekli ve on eksiz adla yapilir.
    const PREFIX_BY_TYPE = { vod: 'VOD | ', series: 'Series | ' };
    for (const [type, typeData] of Object.entries(preview.types)) {
      const prefix = PREFIX_BY_TYPE[type] || '';
      typeData.categories = typeData.categories.map((category) => {
        const exists = localNames.has(category.name) || localNames.has(prefix + category.name);
        return {
          ...category,
          selected: exists,
          isNew: !exists,
        };
      });
    }
    return preview;
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
      const categoryMap = (await this._upsertCategories(playlist.id, categories, trx, jobContext)).map;
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
    // Senkron raporu icin: bu calistirmada gercekten yeni eklenen kategori adlari
    return { map: categoryMap, addedNames: rowsToInsert.map((row) => row.name) };
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
      const categoryMap = (await this._upsertCategories(
        playlist.id,
        groups.map((name, index) => ({ category_id: String(index), category_name: name })),
        trx,
        jobContext
      )).map;
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
