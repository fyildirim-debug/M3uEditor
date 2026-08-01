const backupService = require('../services/BackupService');
const { createAppError } = require('../utils/AppError');

/**
 * GET /api/playlists/:id/backups
 */
async function listBackups(req, res, next) {
  try {
    const backups = await backupService.listBackups(req.userId, req.params.id);
    res.json(backups);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/playlists/:id/backups
 * Body: { reason? } — 'manual' | 'pre-sync' | 'scheduled'
 */
async function createBackup(req, res, next) {
  try {
    const { reason } = req.body || {};
    if (reason !== undefined && !['manual', 'pre-sync', 'scheduled'].includes(reason)) {
      throw createAppError('VALIDATION_ERROR', 'reason manual, pre-sync veya scheduled olmalıdır');
    }
    const backup = await backupService.createBackup(req.userId, req.params.id, reason || 'manual');
    res.status(201).json(backup);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/backups/:backupId/download
 */
async function downloadBackup(req, res, next) {
  try {
    const { filePath, downloadName } = await backupService.getBackupFile(req.userId, req.params.backupId);
    res.download(filePath, downloadName, (err) => {
      if (err && !res.headersSent) next(err);
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/backups/:backupId/restore
 * Body: { targetPlaylistId? } — verilirse o playlist'in uzerine yuklenir,
 * verilmezse yeni playlist olusturulur.
 */
async function restoreBackup(req, res, next) {
  try {
    const { targetPlaylistId } = req.body || {};
    if (targetPlaylistId !== undefined && targetPlaylistId !== null && typeof targetPlaylistId !== 'string') {
      throw createAppError('VALIDATION_ERROR', 'targetPlaylistId geçersiz');
    }
    const result = await backupService.restoreBackup(req.userId, req.params.backupId, targetPlaylistId || null);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/backups/:backupId
 */
async function deleteBackup(req, res, next) {
  try {
    await backupService.deleteBackup(req.userId, req.params.backupId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { listBackups, createBackup, downloadBackup, restoreBackup, deleteBackup };
