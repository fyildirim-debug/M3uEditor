const ImportService = require('../services/ImportService');
const config = require('../config');
const { safeFetchText } = require('../utils/safeFetch');
const { createAppError } = require('../utils/AppError');

const importService = new ImportService();
const activeJobs = new Map();
const jobsByUser = new Map();
const jobsByPlaylist = new Map();
let nextJobId = 1;

function releaseJob(job) {
  if (activeJobs.get(job.id) !== job) return;
  activeJobs.delete(job.id);
  if (jobsByUser.get(job.userKey) === job) jobsByUser.delete(job.userKey);
  if (job.playlistKey && jobsByPlaylist.get(job.playlistKey) === job) jobsByPlaylist.delete(job.playlistKey);
  clearTimeout(job.ttlTimer);
}

function cancelJob(job, message) {
  if (!job.controller.signal.aborted) {
    job.controller.abort(createAppError('IMPORT_CANCELLED', message));
  }
}

function pruneExpiredJobs(now = Date.now()) {
  for (const job of activeJobs.values()) {
    if (job.expiresAt > now) continue;
    cancelJob(job, 'İçe aktarım azami çalışma süresini aştığı için iptal edildi');
    releaseJob(job);
  }
}

function acquireJob(userId, playlistId) {
  pruneExpiredJobs();
  const userKey = String(userId);
  const playlistKey = playlistId ? String(playlistId) : null;

  if (jobsByUser.has(userKey)) {
    throw createAppError('IMPORT_IN_PROGRESS', 'Bu kullanıcı için bir içe aktarım veya senkronizasyon zaten çalışıyor');
  }
  if (playlistKey && jobsByPlaylist.has(playlistKey)) {
    throw createAppError('IMPORT_IN_PROGRESS', 'Bu oynatma listesi için bir senkronizasyon zaten çalışıyor');
  }
  if (activeJobs.size >= config.imports.maxConcurrent) {
    throw createAppError('IMPORT_CAPACITY_REACHED');
  }

  const controller = new AbortController();
  const job = {
    id: nextJobId++,
    userKey,
    playlistKey,
    controller,
    expiresAt: Date.now() + config.imports.jobTtlMs,
    ttlTimer: null,
  };
  job.ttlTimer = setTimeout(() => {
    cancelJob(job, 'İçe aktarım azami çalışma süresini aştığı için iptal edildi');
    releaseJob(job);
  }, config.imports.jobTtlMs);
  job.ttlTimer.unref?.();

  activeJobs.set(job.id, job);
  jobsByUser.set(userKey, job);
  if (playlistKey) jobsByPlaylist.set(playlistKey, job);
  return job;
}

async function runImportJob(req, res, playlistId, worker) {
  const job = acquireJob(req.userId, playlistId);
  const onRequestClose = () => {
    if (req.aborted || req.complete === false) {
      cancelJob(job, 'İstemci istek bağlantısını kapattığı için içe aktarım iptal edildi');
    }
  };
  const onResponseClose = () => {
    if (!res.writableEnded) {
      cancelJob(job, 'İstemci bağlantısını kapattığı için içe aktarım iptal edildi');
    }
  };
  req.on('close', onRequestClose);
  res.on('close', onResponseClose);

  const jobContext = {
    signal: job.controller.signal,
    throwIfCancelled() {
      if (!job.controller.signal.aborted) return;
      throw job.controller.signal.reason || createAppError('IMPORT_CANCELLED');
    },
  };

  try {
    return await worker(jobContext);
  } finally {
    req.removeListener('close', onRequestClose);
    res.removeListener('close', onResponseClose);
    releaseJob(job);
  }
}

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

async function loadM3u(body, jobContext) {
  const { m3uContent, m3uUrl } = body || {};
  if (m3uContent && m3uUrl) throw createAppError('VALIDATION_ERROR', 'M3U içeriği veya URL’den yalnızca birini gönderin');
  if (typeof m3uContent === 'string' && m3uContent.trim()) {
    if (Buffer.byteLength(m3uContent) > config.limits.m3uBytes) throw createAppError('VALIDATION_ERROR', 'M3U içeriği boyut sınırını aşıyor');
    return m3uContent;
  }
  if (typeof m3uUrl === 'string' && m3uUrl.trim()) {
    const response = await safeFetchText(m3uUrl.trim(), {
      timeoutMs: 60_000,
      maxBytes: config.limits.m3uBytes,
      accept: 'audio/x-mpegurl,text/plain',
      signal: jobContext?.signal,
    });
    return response.text;
  }
  throw createAppError('VALIDATION_ERROR', 'M3U içeriği veya URL gerekli');
}

async function importFromXtream(req, res, next) {
  try {
    const result = await runImportJob(req, res, req.params.id, (jobContext) => (
      importService.importFromXtream(req.userId, xtreamCredentials(req.body), undefined, req.params.id, jobContext)
    ));
    res.json(result);
  } catch (error) { next(error); }
}

async function importFromXtreamNew(req, res, next) {
  try {
    const result = await runImportJob(req, res, null, (jobContext) => (
      importService.importFromXtream(req.userId, xtreamCredentials(req.body), undefined, undefined, jobContext)
    ));
    res.status(201).json(result);
  } catch (error) { next(error); }
}

async function syncPlaylist(req, res, next) {
  try {
    const result = await runImportJob(req, res, req.params.id, (jobContext) => (
      importService.syncFromXtream(req.userId, req.params.id, undefined, jobContext)
    ));
    res.json(result);
  } catch (error) { next(error); }
}

async function importFromM3U(req, res, next) {
  try {
    const result = await runImportJob(req, res, null, async (jobContext) => (
      importService.importFromM3U(
        req.userId,
        await loadM3u(req.body, jobContext),
        null,
        req.body?.playlistName,
        jobContext
      )
    ));
    res.status(201).json(result);
  } catch (error) { next(error); }
}

async function importM3UToPlaylist(req, res, next) {
  try {
    const result = await runImportJob(req, res, req.params.id, async (jobContext) => (
      importService.importFromM3U(req.userId, await loadM3u(req.body, jobContext), req.params.id, undefined, jobContext)
    ));
    res.json(result);
  } catch (error) { next(error); }
}

async function addStreamTypes(req, res, next) {
  try {
    if (!Array.isArray(req.body?.streamTypes) || !req.body.streamTypes.length) {
      throw createAppError('VALIDATION_ERROR', 'En az bir içerik türü seçin');
    }
    const result = await runImportJob(req, res, req.params.id, (jobContext) => (
      importService.addStreamTypes(req.userId, req.params.id, req.body.streamTypes, jobContext)
    ));
    res.json(result);
  } catch (error) { next(error); }
}

module.exports = {
  importFromXtream,
  importFromXtreamNew,
  syncPlaylist,
  importFromM3U,
  importM3UToPlaylist,
  addStreamTypes,
};
