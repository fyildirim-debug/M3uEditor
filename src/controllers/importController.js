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

module.exports = { importFromXtream, importFromXtreamNew, syncPlaylist };
