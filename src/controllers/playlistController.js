const playlistService = require('../services/PlaylistService');
const { createAppError } = require('../utils/AppError');

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

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
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
 */
async function updatePlaylist(req, res, next) {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw createAppError('VALIDATION_ERROR', 'name alanı zorunludur');
    }

    const playlist = await playlistService.update(req.userId, id, { name: name.trim() });
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

module.exports = { listPlaylists, createPlaylist, updatePlaylist, deletePlaylist };
