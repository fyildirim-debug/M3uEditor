const exportService = require('../services/ExportService');
const xmltvExportService = require('../services/XMLTVExportService');
const { createAppError } = require('../utils/AppError');
const { validateIdArray } = require('../utils/validation');

async function exportPlaylist(req, res, next) {
  try {
    const { id: playlistId } = req.params;
    const excludeCategories = req.query.excludeCategories
      ? validateIdArray(req.query.excludeCategories.split(',').filter(Boolean))
      : [];
    const streamType = req.query.streamType || null;
    if (streamType && !['live', 'vod', 'series'].includes(streamType)) {
      throw createAppError('VALIDATION_ERROR', 'Geçersiz içerik türü');
    }

    const content = await exportService.exportAsM3U(req.userId, playlistId, excludeCategories, streamType);
    res.setHeader('Content-Type', 'audio/x-mpegurl');
    res.setHeader('Content-Disposition', 'attachment; filename="playlist.m3u"');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(content);
  } catch (error) { next(error); }
}

async function sharePlaylist(req, res, next) {
  try {
    const { id: playlistId } = req.params;
    const { expiresInDays, password } = req.body || {};
    if (expiresInDays !== undefined && (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 365)) {
      throw createAppError('VALIDATION_ERROR', 'Geçerlilik süresi 1-365 gün arasında olmalı');
    }
    if (password && (typeof password !== 'string' || password.length < 10 || password.length > 128)) {
      throw createAppError('VALIDATION_ERROR', 'Paylaşım şifresi 10-128 karakter arasında olmalı');
    }
    res.status(201).json(await exportService.generateShareUrl(req.userId, playlistId, { expiresInDays, password }));
  } catch (error) { next(error); }
}

async function getShared(req, res, next) {
  try {
    const { token } = req.params;
    validateShareToken(token);
    const content = await exportService.getSharedPlaylist(token, req.headers['x-share-password'] || null);
    res.setHeader('Content-Type', 'audio/x-mpegurl');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(content);
  } catch (error) { next(error); }
}

function validateShareToken(token) {
  if (typeof token !== 'string' || token.length > 200) {
    throw createAppError('VALIDATION_ERROR', 'Geçersiz paylaşım belirteci');
  }
}

function sendXmlStream(stream, res, next) {
  stream.once('error', (error) => {
    if (!res.headersSent) next(error);
    else res.destroy(error);
  });
  res.once('close', () => {
    if (!res.writableFinished) stream.destroy();
  });
  stream.pipe(res);
}

async function exportXmltv(req, res, next) {
  try {
    const stream = await xmltvExportService.createAuthenticatedStream(req.userId, req.params.id, req.query.days);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="playlist.xml"');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    sendXmlStream(stream, res, next);
  } catch (error) { next(error); }
}

async function getSharedXmltv(req, res, next) {
  try {
    const { token } = req.params;
    validateShareToken(token);
    const playlist = await exportService.resolveSharedPlaylist(token, req.headers['x-share-password'] || null);
    const stream = await xmltvExportService.createSharedStream(playlist, req.query.days);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="playlist.xml"');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    sendXmlStream(stream, res, next);
  } catch (error) { next(error); }
}

async function getEpgCoverage(req, res, next) {
  try {
    res.json(await xmltvExportService.getCoverage(req.userId, req.params.id));
  } catch (error) { next(error); }
}

module.exports = { exportPlaylist, sharePlaylist, getShared, exportXmltv, getSharedXmltv, getEpgCoverage };
