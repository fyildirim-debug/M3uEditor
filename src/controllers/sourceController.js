const PlaylistSourceService = require('../services/PlaylistSourceService');

const playlistSourceService = new PlaylistSourceService();

/**
 * GET /api/playlists/:id/sources
 */
async function listSources(req, res, next) {
  try {
    res.json(await playlistSourceService.list(req.userId, req.params.id));
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/playlists/:id/sources
 */
async function createSource(req, res, next) {
  try {
    const source = await playlistSourceService.create(req.userId, req.params.id, req.body);
    res.status(201).json(source);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/sources/:id
 */
async function deleteSource(req, res, next) {
  try {
    await playlistSourceService.remove(req.userId, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { listSources, createSource, deleteSource };
