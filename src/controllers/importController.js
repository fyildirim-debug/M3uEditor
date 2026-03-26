const ImportService = require('../services/ImportService');
const { createAppError } = require('../utils/AppError');

/**
 * POST /api/playlists/:id/import/xtream
 * Mevcut playlist'e Xtream Codes kanallarını içe aktar
 */
async function importFromXtream(req, res, next) {
  try {
    const { id: playlistId } = req.params;
    const { serverUrl, username, password, streamTypes } = req.body;

    if (!serverUrl || !username || !password) {
      throw createAppError('VALIDATION_ERROR', 'serverUrl, username ve password alanları zorunludur');
    }

    const validTypes = ['live', 'vod', 'series'];
    const types = Array.isArray(streamTypes) ? streamTypes.filter(t => validTypes.includes(t)) : ['live'];

    const importService = new ImportService();
    const result = await importService.importFromXtream(req.userId, { serverUrl, username, password, streamTypes: types }, undefined, playlistId);

    res.json({
      totalChannels: result.totalChannels,
      totalCategories: result.totalCategories,
      duration: result.duration,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/import/xtream
 * Playlist olmadan Xtream Codes ile içe aktar (yeni playlist oluşturur veya mevcut olanı bulur)
 */
async function importFromXtreamNew(req, res, next) {
  try {
    const { serverUrl, username, password, streamTypes } = req.body;

    if (!serverUrl || !username || !password) {
      throw createAppError('VALIDATION_ERROR', 'serverUrl, username ve password alanları zorunludur');
    }

    const validTypes = ['live', 'vod', 'series'];
    const types = Array.isArray(streamTypes) ? streamTypes.filter(t => validTypes.includes(t)) : ['live'];

    const importService = new ImportService();
    const result = await importService.importFromXtream(req.userId, { serverUrl, username, password, streamTypes: types }, undefined, null);

    res.json({
      playlistId: result.playlistId,
      totalChannels: result.totalChannels,
      totalCategories: result.totalCategories,
      duration: result.duration,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/playlists/:id/sync
 */
async function syncPlaylist(req, res, next) {
  try {
    const { id: playlistId } = req.params;

    const importService = new ImportService();
    const result = await importService.syncFromXtream(req.userId, playlistId);

    res.json({
      added: result.added,
      updated: result.updated,
      removed: result.removed,
      duration: result.duration,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/import/m3u
 * Import from M3U file content or URL
 */
async function importFromM3U(req, res, next) {
  try {
    const { m3uContent, m3uUrl, playlistName } = req.body;
    let content = m3uContent;

    if (!content && m3uUrl) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      try {
        const response = await fetch(m3uUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        content = await response.text();
      } catch (err) {
        clearTimeout(timeoutId);
        throw createAppError('IMPORT_FAILED', `M3U URL alinamadi: ${err.message}`);
      }
    }

    if (!content) {
      throw createAppError('VALIDATION_ERROR', 'm3uContent veya m3uUrl gereklidir');
    }

    const importService = new ImportService();
    const result = await importService.importFromM3U(req.userId, content, null, playlistName);

    res.json({
      playlistId: result.playlistId,
      totalChannels: result.totalChannels,
      totalCategories: result.totalCategories,
      duration: result.duration,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/playlists/:id/import/m3u
 * Import M3U into existing playlist
 */
async function importM3UToPlaylist(req, res, next) {
  try {
    const { id: playlistId } = req.params;
    const { m3uContent, m3uUrl } = req.body;
    let content = m3uContent;

    if (!content && m3uUrl) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      try {
        const response = await fetch(m3uUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        content = await response.text();
      } catch (err) {
        clearTimeout(timeoutId);
        throw createAppError('IMPORT_FAILED', `M3U URL alinamadi: ${err.message}`);
      }
    }

    if (!content) {
      throw createAppError('VALIDATION_ERROR', 'm3uContent veya m3uUrl gereklidir');
    }

    const importService = new ImportService();
    const result = await importService.importFromM3U(req.userId, content, playlistId);

    res.json({
      totalChannels: result.totalChannels,
      totalCategories: result.totalCategories,
      duration: result.duration,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/playlists/:id/import/add-types
 * Add new stream types (vod/series) to existing playlist using stored Xtream credentials.
 */
async function addStreamTypes(req, res, next) {
  try {
    const { id: playlistId } = req.params;
    const { streamTypes } = req.body;

    if (!Array.isArray(streamTypes) || streamTypes.length === 0) {
      throw createAppError('VALIDATION_ERROR', 'streamTypes bos olmayan bir dizi olmalidir');
    }

    const validTypes = ['live', 'vod', 'series'];
    const types = streamTypes.filter(t => validTypes.includes(t));
    if (types.length === 0) {
      throw createAppError('VALIDATION_ERROR', 'Gecerli icerik tipi belirtilmedi (live, vod, series)');
    }

    const importService = new ImportService();
    const result = await importService.addStreamTypes(req.userId, playlistId, types);

    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { importFromXtream, importFromXtreamNew, syncPlaylist, importFromM3U, importM3UToPlaylist, addStreamTypes };
