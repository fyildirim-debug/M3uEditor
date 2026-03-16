const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const XtreamClient = require('./XtreamClient');
const { createAppError } = require('../utils/AppError');

const BATCH_SIZE = 100;

class ImportService {
  /**
   * Import channels from Xtream Codes API.
   * @param {string} userId
   * @param {{ serverUrl: string, username: string, password: string }} credentials
   * @param {function} [onProgress] - Progress callback ({ processed, total })
   * @returns {Promise<{ totalChannels: number, totalCategories: number, duration: number }>}
   */
  async importFromXtream(userId, credentials, onProgress, playlistId) {
    const startTime = Date.now();
    const { serverUrl, username, password, streamTypes = ['live'] } = credentials;

    const client = new XtreamClient(serverUrl, username, password);

    try {
      await client.authenticate();
    } catch (err) {
      if (err.code === 'XTREAM_AUTH_FAILED' || err.code === 'XTREAM_CONNECTION_FAILED') {
        throw err;
      }
      throw createAppError('IMPORT_FAILED', err.message);
    }

    const { categories, channels } = await client.getAllChannels(streamTypes);

    // Use existing playlist if provided, otherwise create/get one
    let playlist;
    if (playlistId) {
      playlist = await db('playlists').where({ id: playlistId, user_id: userId }).first();
      if (!playlist) throw createAppError('NOT_FOUND', 'Playlist bulunamadı');
      // Store xtream credentials and stream types on the playlist for future sync
      await db('playlists').where({ id: playlistId }).update({
        xtream_server_url: serverUrl.replace(/\/+$/, ''),
        xtream_username: username,
        xtream_password_enc: password,
        xtream_stream_types: JSON.stringify(streamTypes),
        updated_at: new Date()
      });
    } else {
      playlist = await this._getOrCreatePlaylist(userId, credentials);
    }

    // Create categories in DB and build name → id mapping
    const categoryMap = await this._upsertCategories(playlist.id, categories);

    // Kanal kayıtlarını oluştur ve toplu upsert yap
    const channelRecords = channels.map((ch, index) => {
      const baseUrl = serverUrl.replace(/\/+$/, '');
      const ext = ch.container_extension || 'ts';

      // Stream tipine göre URL formatı
      let urlPath;
      switch (ch.stream_type) {
        case 'vod': urlPath = 'movie'; break;
        case 'series': urlPath = 'series'; break;
        default: urlPath = 'live'; break;
      }
      const streamUrl = `${baseUrl}/${urlPath}/${username}/${password}/${ch.stream_id}.${ext}`;

      return {
        id: uuidv4(),
        playlist_id: playlist.id,
        name: ch.name,
        logo_url: ch.stream_icon || null,
        original_logo_url: ch.stream_icon || null,
        stream_url: streamUrl,
        epg_channel_id: ch.epg_channel_id || null,
        category_id: ch.category_id ? (categoryMap[ch.category_id] || null) : null,
        sort_order: index,
        stream_type: ch.stream_type || 'live',
        original_name: ch.name,
        extras: JSON.stringify({
          stream_id: ch.stream_id,
          stream_type: ch.stream_type || 'live',
          ...(ch.rating && { rating: ch.rating }),
          ...(ch.genre && { genre: ch.genre }),
          ...(ch.plot && { plot: ch.plot }),
          ...(ch.year && { year: ch.year }),
          ...(ch.tmdb_id && { tmdb_id: ch.tmdb_id }),
          metadata_fetched: false,
        }),
      };
    });

    await this._bulkUpsertChannels(playlist.id, channelRecords, onProgress);

    // Update last_synced_at
    await db('playlists').where({ id: playlist.id }).update({ last_synced_at: new Date(), updated_at: new Date() });

    const duration = Date.now() - startTime;
    return { playlistId: playlist.id, totalChannels: channelRecords.length, totalCategories: categories.length, duration };
  }

  /**
   * Sync channels from a previously imported Xtream source.
   * @param {string} userId
   * @param {string} playlistId - The playlist ID to sync
   * @param {function} [onProgress] - Progress callback ({ processed, total })
   * @returns {Promise<{ added: number, updated: number, removed: number, duration: number }>}
   */
  async syncFromXtream(userId, playlistId, onProgress) {
    const startTime = Date.now();

    // Load existing playlist with stored credentials
    const playlist = await db('playlists')
      .where({ id: playlistId, user_id: userId })
      .first();

    if (!playlist) {
      throw createAppError('NOT_FOUND', 'Playlist bulunamadı');
    }

    if (!playlist.xtream_server_url || !playlist.xtream_username || !playlist.xtream_password_enc) {
      throw createAppError('VALIDATION_ERROR', 'Bu playlist Xtream Codes kaynağına sahip değil');
    }

    // Count existing channels before sync
    const beforeCount = await db('channels')
      .where({ playlist_id: playlistId })
      .count('id as count')
      .first();
    const existingCount = parseInt(beforeCount.count, 10);

    // Get existing stream URLs to track added vs updated
    const existingUrls = new Set(
      (await db('channels').where({ playlist_id: playlistId }).select('stream_url'))
        .map((r) => r.stream_url)
    );

    // Re-import using importFromXtream logic
    const streamTypes = playlist.xtream_stream_types
      ? JSON.parse(playlist.xtream_stream_types)
      : ['live'];
    const credentials = {
      serverUrl: playlist.xtream_server_url,
      username: playlist.xtream_username,
      password: playlist.xtream_password_enc,
      streamTypes,
    };

    const result = await this.importFromXtream(userId, credentials, onProgress, playlistId);

    // Calculate added vs updated
    const afterUrls = new Set(
      (await db('channels').where({ playlist_id: playlistId }).select('stream_url'))
        .map((r) => r.stream_url)
    );

    let added = 0;
    let updated = 0;
    for (const url of afterUrls) {
      if (existingUrls.has(url)) {
        updated++;
      } else {
        added++;
      }
    }

    // Channels that were in old set but not in new set
    let removed = 0;
    for (const url of existingUrls) {
      if (!afterUrls.has(url)) {
        removed++;
      }
    }

    const duration = Date.now() - startTime;
    return { added, updated, removed, duration };
  }

  /**
   * Get or create a playlist for the given user + server combination.
   * @private
   */
  async _getOrCreatePlaylist(userId, credentials) {
    const { serverUrl, username, password, streamTypes = ['live'] } = credentials;
    const normalizedUrl = serverUrl.replace(/\/+$/, '');

    let playlist = await db('playlists')
      .where({
        user_id: userId,
        xtream_server_url: normalizedUrl,
        xtream_username: username,
      })
      .first();

    if (!playlist) {
      const [created] = await db('playlists')
        .insert({
          id: uuidv4(),
          user_id: userId,
          name: `${username}`,
          xtream_server_url: normalizedUrl,
          xtream_username: username,
          xtream_password_enc: password,
          xtream_stream_types: JSON.stringify(streamTypes),
        })
        .returning('*');
      playlist = created;
    } else {
      await db('playlists').where({ id: playlist.id }).update({
        xtream_stream_types: JSON.stringify(streamTypes),
        updated_at: new Date(),
      });
    }

    return playlist;
  }

  /**
   * Upsert categories and return a mapping of xtream category_id → DB category UUID.
   * @private
   */
  async _upsertCategories(playlistId, categories) {
    const categoryMap = {};

    if (categories.length === 0) return categoryMap;

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];

      // Check if category already exists for this playlist with same name
      let existing = await db('categories')
        .where({ playlist_id: playlistId, name: cat.category_name })
        .first();

      if (existing) {
        categoryMap[cat.category_id] = existing.id;
      } else {
        const [created] = await db('categories')
          .insert({
            id: uuidv4(),
            playlist_id: playlistId,
            name: cat.category_name,
            sort_order: i,
          })
          .returning('*');
        categoryMap[cat.category_id] = created.id;
      }
    }

    return categoryMap;
  }

  /**
   * Bulk upsert channels in batches using INSERT ON CONFLICT DO UPDATE.
   * Duplicate stream_url'ler batch içinde temizlenir.
   * @private
   */
  async _bulkUpsertChannels(playlistId, channelRecords, onProgress) {
    // Aynı stream_url'e sahip kanalları temizle (son gelen kazanır)
    const uniqueMap = new Map();
    for (const rec of channelRecords) {
      uniqueMap.set(rec.stream_url, rec);
    }
    const uniqueRecords = Array.from(uniqueMap.values());
    const total = uniqueRecords.length;

    const CONFLICT_CLAUSE = `ON CONFLICT (playlist_id, stream_url) DO UPDATE SET
      original_name       = EXCLUDED.original_name,
      original_logo_url   = EXCLUDED.original_logo_url,
      stream_type         = EXCLUDED.stream_type,
      extras              = EXCLUDED.extras,
      updated_at          = NOW(),
      name      = CASE WHEN channels.name IS NOT DISTINCT FROM channels.original_name
                       THEN EXCLUDED.name ELSE channels.name END,
      logo_url  = CASE WHEN channels.logo_url IS NOT DISTINCT FROM channels.original_logo_url
                       THEN EXCLUDED.logo_url ELSE channels.logo_url END`;

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = uniqueRecords.slice(i, i + BATCH_SIZE);

      // Extract SQL + bindings from Knex builder then append raw conflict clause
      const { sql, bindings } = db('channels').insert(batch).toSQL();
      await db.raw(`${sql} ${CONFLICT_CLAUSE}`, bindings);

      if (typeof onProgress === 'function') {
        onProgress({ processed: Math.min(i + BATCH_SIZE, total), total });
      }
    }
  }
}

module.exports = ImportService;
