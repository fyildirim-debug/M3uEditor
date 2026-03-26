const exportService = require('../services/ExportService');

/**
 * GET /api/playlists/:id/export
 * Export playlist as M3U file download.
 */
async function exportPlaylist(req, res, next) {
  try {
    const { id: playlistId } = req.params;
    const excludeCategories = req.query.excludeCategories
      ? req.query.excludeCategories.split(',').filter(Boolean)
      : [];
    const streamType = req.query.streamType || null;

    const m3uContent = await exportService.exportAsM3U(req.userId, playlistId, excludeCategories, streamType);

    res.setHeader('Content-Type', 'audio/x-mpegurl');
    res.setHeader('Content-Disposition', 'attachment; filename="playlist.m3u"');
    res.send(m3uContent);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/playlists/:id/share
 * Generate a share URL for a playlist.
 */
async function sharePlaylist(req, res, next) {
  try {
    const { id: playlistId } = req.params;
    const { expiresInDays, password } = req.body || {};
    const result = await exportService.generateShareUrl(req.userId, playlistId, { expiresInDays, password });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/shared/:token
 * Serve a shared playlist as M3U content. No auth required.
 */
async function getShared(req, res, next) {
  try {
    const { token } = req.params;
    const password = req.query.password || req.headers['x-share-password'] || null;
    const m3uContent = await exportService.getSharedPlaylist(token, password);

    res.setHeader('Content-Type', 'audio/x-mpegurl');
    res.send(m3uContent);
  } catch (err) {
    next(err);
  }
}

module.exports = { exportPlaylist, sharePlaylist, getShared };
