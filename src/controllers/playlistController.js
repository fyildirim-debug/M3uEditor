const playlistService = require('../services/PlaylistService');
const { createAppError } = require('../utils/AppError');

const MAX_SYNC_INTERVAL_MINUTES = 525600; // 1 yil

function validateSyncInterval(value) {
  if (value === null) return;
  if (!Number.isInteger(value) || value < 1 || value > MAX_SYNC_INTERVAL_MINUTES) {
    throw createAppError('VALIDATION_ERROR', 'syncIntervalMinutes null veya 1-525600 arasi bir tam sayi olmali');
  }
}

/**
 * GET /api/playlists
 */
async function listPlaylists(req, res, next) {
  try {
    const playlists = await playlistService.list(req.userId);
    res.json(playlists);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/playlists
 */
async function createPlaylist(req, res, next) {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 255) {
      throw createAppError('VALIDATION_ERROR', 'name alanı zorunludur');
    }

    const playlist = await playlistService.create(req.userId, { name: name.trim() });
    res.status(201).json(playlist);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/playlists/:id
 * Accepts partial updates: name and/or Xtream credentials.
 */
async function updatePlaylist(req, res, next) {
  try {
    const { id } = req.params;
    const { name, xtreamServerUrl, xtreamUsername, xtreamPassword } = req.body || {};

    if (name === undefined && xtreamServerUrl === undefined && xtreamUsername === undefined && xtreamPassword === undefined) {
      throw createAppError('VALIDATION_ERROR', 'Güncellenecek en az bir alan gönderin');
    }
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0 || name.length > 255)) {
      throw createAppError('VALIDATION_ERROR', 'name alanı 1-255 karakter olmalıdır');
    }
    if (xtreamServerUrl !== undefined && (typeof xtreamServerUrl !== 'string' || !xtreamServerUrl.trim() || xtreamServerUrl.length > 2048)) {
      throw createAppError('VALIDATION_ERROR', 'Sunucu adresi geçersiz');
    }
    if (xtreamUsername !== undefined && (typeof xtreamUsername !== 'string' || !xtreamUsername.trim() || xtreamUsername.length > 500)) {
      throw createAppError('VALIDATION_ERROR', 'Kullanıcı adı geçersiz');
    }
    if (xtreamPassword !== undefined && (typeof xtreamPassword !== 'string' || !xtreamPassword || xtreamPassword.length > 500)) {
      throw createAppError('VALIDATION_ERROR', 'Şifre geçersiz');
    }

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (xtreamServerUrl !== undefined) updates.xtreamServerUrl = xtreamServerUrl.trim();
    if (xtreamUsername !== undefined) updates.xtreamUsername = xtreamUsername.trim();
    if (xtreamPassword !== undefined) updates.xtreamPassword = xtreamPassword;

    const playlist = await playlistService.update(req.userId, id, updates);
    res.json(playlist);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/playlists/:id
 */
async function deletePlaylist(req, res, next) {
  try {
    const { id } = req.params;
    await playlistService.delete(req.userId, id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/playlists/:id/sync-settings
 */
async function updateSyncSettings(req, res, next) {
  try {
    const { id } = req.params;
    const { syncIntervalMinutes, backupBeforeSync } = req.body || {};

    if (syncIntervalMinutes === undefined && backupBeforeSync === undefined) {
      throw createAppError('VALIDATION_ERROR', 'Guncellenecek alan belirtilmedi');
    }
    if (syncIntervalMinutes !== undefined) validateSyncInterval(syncIntervalMinutes);
    if (backupBeforeSync !== undefined && typeof backupBeforeSync !== 'boolean') {
      throw createAppError('VALIDATION_ERROR', 'backupBeforeSync boolean olmali');
    }

    const playlist = await playlistService.updateSyncSettings(req.userId, id, { syncIntervalMinutes, backupBeforeSync });
    res.json(playlist);
  } catch (err) {
    next(err);
  }
}

module.exports = { listPlaylists, createPlaylist, updatePlaylist, deletePlaylist, updateSyncSettings };
