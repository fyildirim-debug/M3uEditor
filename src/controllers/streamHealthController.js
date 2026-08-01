const db = require('../config/database');
const streamHealthService = require('../services/StreamHealthService');
const { createAppError } = require('../utils/AppError');

async function startHealthScan(req, res, next) {
  try {
    const { streamType } = req.body || {};
    const job = await streamHealthService.scanPlaylist(req.userId, req.params.id, { streamType });
    res.status(202).json({
      running: job.running,
      checked: job.checked,
      total: job.total,
      dead: job.dead,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
    });
  } catch (error) { next(error); }
}

async function getHealthScanStatus(req, res, next) {
  try {
    res.json(await streamHealthService.getScanStatus(req.userId, req.params.id));
  } catch (error) { next(error); }
}

async function getHealthStats(req, res, next) {
  try {
    const playlist = await db('playlists').where({ id: req.params.id, user_id: req.userId }).first();
    if (!playlist) throw createAppError('NOT_FOUND');
    res.json(await streamHealthService.getStats(req.params.id));
  } catch (error) { next(error); }
}

module.exports = { startHealthScan, getHealthScanStatus, getHealthStats };
