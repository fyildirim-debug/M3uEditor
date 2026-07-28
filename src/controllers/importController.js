const ImportService = require('../services/ImportService');
const config = require('../config');
const { safeFetchText } = require('../utils/safeFetch');
const { createAppError } = require('../utils/AppError');

const importService = new ImportService();

function xtreamCredentials(body) {
  const { serverUrl, username, password, streamTypes, playlistName } = body || {};
  if (![serverUrl, username, password].every((value) => typeof value === 'string' && value.trim())) {
    throw createAppError('VALIDATION_ERROR', 'Sunucu adresi, kullanıcı adı ve şifre gerekli');
  }
  if (serverUrl.length > 2048 || username.length > 500 || password.length > 500) {
    throw createAppError('VALIDATION_ERROR', 'Xtream bağlantı bilgileri çok uzun');
  }
  return { serverUrl: serverUrl.trim(), username: username.trim(), password, streamTypes, playlistName };
}

async function loadM3u(body) {
  const { m3uContent, m3uUrl } = body || {};
  if (m3uContent && m3uUrl) throw createAppError('VALIDATION_ERROR', 'M3U içeriği veya URL’den yalnızca birini gönderin');
  if (typeof m3uContent === 'string' && m3uContent.trim()) {
    if (Buffer.byteLength(m3uContent) > config.limits.m3uBytes) throw createAppError('VALIDATION_ERROR', 'M3U içeriği boyut sınırını aşıyor');
    return m3uContent;
  }
  if (typeof m3uUrl === 'string' && m3uUrl.trim()) {
    const response = await safeFetchText(m3uUrl.trim(), { timeoutMs: 60_000, maxBytes: config.limits.m3uBytes, accept: 'audio/x-mpegurl,text/plain' });
    return response.text;
  }
  throw createAppError('VALIDATION_ERROR', 'M3U içeriği veya URL gerekli');
}

async function importFromXtream(req, res, next) {
  try {
    const result = await importService.importFromXtream(req.userId, xtreamCredentials(req.body), undefined, req.params.id);
    res.json(result);
  } catch (error) { next(error); }
}

async function importFromXtreamNew(req, res, next) {
  try {
    const result = await importService.importFromXtream(req.userId, xtreamCredentials(req.body));
    res.status(201).json(result);
  } catch (error) { next(error); }
}

async function syncPlaylist(req, res, next) {
  try { res.json(await importService.syncFromXtream(req.userId, req.params.id)); } catch (error) { next(error); }
}

async function importFromM3U(req, res, next) {
  try {
    const result = await importService.importFromM3U(req.userId, await loadM3u(req.body), null, req.body?.playlistName);
    res.status(201).json(result);
  } catch (error) { next(error); }
}

async function importM3UToPlaylist(req, res, next) {
  try { res.json(await importService.importFromM3U(req.userId, await loadM3u(req.body), req.params.id)); } catch (error) { next(error); }
}

async function addStreamTypes(req, res, next) {
  try {
    if (!Array.isArray(req.body?.streamTypes) || !req.body.streamTypes.length) {
      throw createAppError('VALIDATION_ERROR', 'En az bir içerik türü seçin');
    }
    res.json(await importService.addStreamTypes(req.userId, req.params.id, req.body.streamTypes));
  } catch (error) { next(error); }
}

module.exports = { importFromXtream, importFromXtreamNew, syncPlaylist, importFromM3U, importM3UToPlaylist, addStreamTypes };
