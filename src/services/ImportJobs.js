/**
 * Surec ici ice aktarim kilidi.
 *
 * Ayni kullanici icin ayni anda tek bir ice aktarim/senkronizasyon, ayni playlist
 * icin tek bir is ve sunucu genelinde en fazla MAX_CONCURRENT_IMPORTS is calisir.
 * Eskiden yalnizca HTTP yolu (importController) bu kilidi aliyordu; zamanlanmis
 * sync ve yedek geri yukleme de ayni kilidi kullansin diye ayri modulde durur.
 */
const config = require('../config');
const { createAppError } = require('../utils/AppError');

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

/**
 * Kilidi alir; mesgulse IMPORT_IN_PROGRESS / IMPORT_CAPACITY_REACHED firlatir.
 * @param {string} userId
 * @param {string|null} playlistId
 * @param {{ kind?: string }} [options]
 */
function acquireJob(userId, playlistId, { kind = 'import' } = {}) {
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
    kind,
    userKey,
    playlistKey,
    controller,
    progress: null,
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

/** ImportService'in bekledigi jobContext nesnesi */
function jobContextFor(job) {
  return {
    signal: job.controller.signal,
    onProgress({ processed, total }) {
      job.progress = { processed, total };
    },
    throwIfCancelled() {
      if (!job.controller.signal.aborted) return;
      throw job.controller.signal.reason || createAppError('IMPORT_CANCELLED');
    },
  };
}

/**
 * Kilidi alip worker'i calistirir, sonunda kilidi birakir.
 * @param {string} userId
 * @param {string|null} playlistId
 * @param {(jobContext: object) => Promise<any>} worker
 * @param {{ kind?: string }} [options]
 */
async function runExclusive(userId, playlistId, worker, options) {
  const job = acquireJob(userId, playlistId, options);
  try {
    return await worker(jobContextFor(job));
  } finally {
    releaseJob(job);
  }
}

function isBusyError(error) {
  return error?.code === 'IMPORT_IN_PROGRESS' || error?.code === 'IMPORT_CAPACITY_REACHED';
}

function listUserJobs(userId) {
  pruneExpiredJobs();
  const userKey = String(userId);
  return [...activeJobs.values()].filter((job) => job.userKey === userKey);
}

module.exports = {
  acquireJob,
  releaseJob,
  cancelJob,
  pruneExpiredJobs,
  jobContextFor,
  runExclusive,
  isBusyError,
  listUserJobs,
};
