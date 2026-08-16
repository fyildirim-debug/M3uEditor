const dns = require('dns').promises;
const http = require('http');
const https = require('https');
const net = require('net');
const { Readable } = require('stream');
const zlib = require('zlib');
const ipaddr = require('ipaddr.js');
const config = require('../config');
const { createAppError } = require('./AppError');

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
// captureErrorBody istendiginde hata govdesinden okunacak azami bayt.
const ERROR_BODY_LIMIT = 16 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;

function normalizeIp(address) {
  const parsed = ipaddr.parse(address);
  return parsed.kind() === 'ipv6' && parsed.isIPv4MappedAddress() ? parsed.toIPv4Address() : parsed;
}

/**
 * @param {string} address
 * @param {boolean} [allowPrivate] Yalnizca SUNUCU YAPILANDIRMASINDAN gelen
 *   adresler icin true olur (ornegin yigin ici SearXNG). Kullanicidan ya da
 *   modelden gelen hicbir adres bu bayragi tasiyamaz; tasisaydi SSRF korumasi
 *   anlamsizlasirdi.
 */
function isBlockedIp(address, allowPrivate = false) {
  if (config.allowPrivateNetworkUrls || allowPrivate) return false;
  try {
    return normalizeIp(address).range() !== 'unicast';
  } catch {
    return true;
  }
}

async function resolvePublicAddress(hostname, allowPrivate = false) {
  const addresses = net.isIP(hostname)
    ? [{ address: hostname, family: net.isIP(hostname) }]
    : await dns.lookup(hostname, { all: true, verbatim: true });

  if (!addresses.length || addresses.some(({ address }) => isBlockedIp(address, allowPrivate))) {
    throw createAppError('FORBIDDEN', 'Özel veya ayrılmış ağ adreslerine bağlantı kurulamaz');
  }

  return addresses[0];
}

function createPinnedLookup(resolved) {
  return (_hostname, lookupOptions, callback) => {
    if (lookupOptions && typeof lookupOptions === 'object' && lookupOptions.all) {
      callback(null, [{ address: resolved.address, family: resolved.family }]);
      return;
    }

    callback(null, resolved.address, resolved.family);
  };
}

function parseRemoteUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw createAppError('VALIDATION_ERROR', 'Geçerli bir HTTP(S) adresi girin');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw createAppError('VALIDATION_ERROR', 'Yalnızca kullanıcı bilgisi içermeyen HTTP(S) adresleri desteklenir');
  }
  return url;
}

function decompressedStream(response) {
  const encoding = String(response.headers['content-encoding'] || '').toLowerCase();
  if (encoding === 'gzip' || encoding === 'x-gzip') return response.pipe(zlib.createGunzip());
  if (encoding === 'deflate') return response.pipe(zlib.createInflate());
  if (encoding === 'br') return response.pipe(zlib.createBrotliDecompress());
  return response;
}

function positiveLimit(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw createAppError('VALIDATION_ERROR', 'Uzak istek bütçesi geçersiz');
  }
  return parsed;
}

/**
 * Bir üst seviye çağrının tüm yönlendirmelerinde paylaşılacak mutlak bütçe.
 * `byteBudget` çağıran tarafından verilecekse `{ remaining: number }` biçiminde
 * olmalıdır; nesne yerinde güncellendiği için birden fazla çağrı da aynı sayacı
 * paylaşabilir.
 */
function createRequestBudget(options) {
  const timeoutMs = positiveLimit(options.timeoutMs, DEFAULT_TIMEOUT_MS);
  const maxBytes = positiveLimit(options.maxBytes, DEFAULT_MAX_BYTES);
  const deadline = options.deadline === undefined ? Date.now() + timeoutMs : Number(options.deadline);
  if (!Number.isFinite(deadline)) {
    throw createAppError('VALIDATION_ERROR', 'Uzak istek zaman bütçesi geçersiz');
  }

  let byteBudget = options.byteBudget;
  if (byteBudget === undefined) byteBudget = { remaining: maxBytes };
  else if (typeof byteBudget === 'number') byteBudget = { remaining: byteBudget };
  if (!byteBudget || typeof byteBudget !== 'object') {
    throw createAppError('VALIDATION_ERROR', 'Uzak istek bayt bütçesi geçersiz');
  }
  const remaining = Number(byteBudget.remaining);
  if (!Number.isFinite(remaining) || remaining < 0) {
    throw createAppError('VALIDATION_ERROR', 'Uzak istek bayt bütçesi geçersiz');
  }
  byteBudget.remaining = remaining;

  return { deadline, byteBudget };
}

function deadlineError() {
  const error = createAppError('XTREAM_CONNECTION_FAILED', 'Uzak istek toplam süre bütçesini aştı');
  error.budgetExhausted = true;
  error.budgetType = 'deadline';
  return error;
}

function byteBudgetError() {
  const error = createAppError('VALIDATION_ERROR', 'Uzak içerik toplam bayt bütçesini aşıyor');
  error.budgetExhausted = true;
  error.budgetType = 'bytes';
  return error;
}

function abortError(signal) {
  if (signal?.reason?.statusCode) return signal.reason;
  const error = createAppError('IMPORT_CANCELLED', 'Uzak istek iptal edildi');
  error.name = 'AbortError';
  return error;
}

function remainingTime(budget) {
  return budget.deadline - Date.now();
}

function assertBudget(budget, signal) {
  if (signal?.aborted) throw abortError(signal);
  if (remainingTime(budget) <= 0) throw deadlineError();
  if (budget.byteBudget.remaining <= 0) throw byteBudgetError();
}

function consumeBytes(budget, byteLength) {
  if (byteLength > budget.byteBudget.remaining) {
    budget.byteBudget.remaining = 0;
    throw byteBudgetError();
  }
  budget.byteBudget.remaining -= byteLength;
}

function normalizeRemoteError(error) {
  if (error?.statusCode) return error;
  return createAppError('XTREAM_CONNECTION_FAILED', error?.message || 'Uzak sunucu bağlantı hatası');
}

function setDeadlineTimer(budget, callback) {
  const delay = remainingTime(budget);
  if (delay <= 0) {
    queueMicrotask(callback);
    return null;
  }
  return setTimeout(callback, Math.min(delay, 2_147_483_647));
}

async function withinBudget(promise, budget, signal) {
  assertBudget(budget, signal);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      callback(value);
    };
    const onAbort = () => finish(reject, abortError(signal));
    const timer = setDeadlineTimer(budget, () => finish(reject, deadlineError()));
    signal?.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(promise).then(
      (value) => finish(resolve, value),
      (error) => finish(reject, error)
    );
  });
}

function limitedStream(source, budget) {
  return Readable.from((async function* enforceBudget() {
    for await (const chunk of source) {
      consumeBytes(budget, chunk.length);
      yield chunk;
    }
  }()));
}

async function requestRemote(input, options, redirectCount, budget, mode) {
  assertBudget(budget, options.signal);
  const url = parseRemoteUrl(input);
  const resolved = await withinBudget(resolvePublicAddress(url.hostname, options.allowPrivateHost === true), budget, options.signal);
  assertBudget(budget, options.signal);

  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    let decoded;
    let outputStream;
    let settled = false;
    let cleanedUp = false;

    const request = transport.request(url, {
      method: options.method || 'GET',
      headers: {
        accept: options.accept || '*/*',
        'accept-encoding': 'gzip, deflate, br',
        'user-agent': 'M3UEditor/1.0',
        ...options.headers,
      },
      lookup: createPinnedLookup(resolved),
    });

    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      if (timer) clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    };
    const fail = (error) => {
      const normalized = normalizeRemoteError(error);
      cleanup();
      if (settled) {
        if (outputStream && !outputStream.destroyed) outputStream.destroy(normalized);
        return;
      }
      settled = true;
      reject(normalized);
    };
    const terminate = (error) => {
      if (decoded && !decoded.destroyed) decoded.destroy(error);
      if (outputStream && !outputStream.destroyed) outputStream.destroy(error);
      if (!request.destroyed) request.destroy(error);
      fail(error);
    };
    const onAbort = () => terminate(abortError(options.signal));
    const timer = setDeadlineTimer(budget, () => terminate(deadlineError()));
    options.signal?.addEventListener('abort', onAbort, { once: true });

    request.on('response', (response) => {
      if (REDIRECT_CODES.has(response.statusCode) && response.headers.location) {
        cleanup();
        response.destroy();
        if (redirectCount >= MAX_REDIRECTS) {
          fail(createAppError('VALIDATION_ERROR', 'Çok fazla yönlendirme alındı'));
          return;
        }
        let redirected;
        try {
          redirected = new URL(response.headers.location, url).toString();
        } catch {
          fail(createAppError('VALIDATION_ERROR', 'Geçersiz yönlendirme adresi alındı'));
          return;
        }
        settled = true;
        resolve(requestRemote(redirected, options, redirectCount + 1, budget, mode));
        return;
      }

      const isHead = (options.method || 'GET') === 'HEAD';
      const declaredLength = Number(response.headers['content-length']);
      if (!isHead && Number.isFinite(declaredLength) && declaredLength > budget.byteBudget.remaining) {
        response.destroy();
        fail(byteBudgetError());
        return;
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        const httpError = createAppError('XTREAM_CONNECTION_FAILED', `Uzak sunucu HTTP ${response.statusCode} döndürdü`);
        httpError.remoteStatus = response.statusCode;
        if (!options.captureErrorBody) {
          response.destroy();
          fail(httpError);
          return;
        }

        // API gecitleri hatanin gerekcesini govdede dondurur ("model does not
        // support tools" gibi). Yalnizca istenildiginde ve kisa bir sinirla
        // okunur; buyuk hata sayfalari bellege alinmaz.
        const errorStream = decompressedStream(response);
        const chunks = [];
        let captured = 0;
        let done = false;
        const finishWithBody = () => {
          if (done) return;
          done = true;
          httpError.remoteBody = Buffer.concat(chunks).toString('utf8');
          fail(httpError);
        };
        errorStream.on('data', (chunk) => {
          const room = ERROR_BODY_LIMIT - captured;
          if (room <= 0) { errorStream.destroy(); finishWithBody(); return; }
          chunks.push(chunk.length > room ? chunk.subarray(0, room) : chunk);
          captured += Math.min(chunk.length, room);
        });
        errorStream.once('end', finishWithBody);
        errorStream.once('close', finishWithBody);
        errorStream.once('error', finishWithBody);
        return;
      }

      if (isHead) {
        response.resume();
        cleanup();
        settled = true;
        const common = { status: response.statusCode, headers: response.headers, url: url.toString() };
        resolve(mode === 'stream'
          ? { ...common, stream: Readable.from([]) }
          : { ...common, buffer: Buffer.alloc(0) });
        return;
      }

      decoded = decompressedStream(response);
      outputStream = limitedStream(decoded, budget);
      // Async iterator tuketicisi hatayi almaya devam eder; bos error listener ise
      // deadline'in iterasyon baslamadan dolmasini unhandled event olmaktan korur.
      outputStream.on('error', () => {});

      const common = { status: response.statusCode, headers: response.headers, url: url.toString() };
      if (mode === 'stream') {
        outputStream.once('end', cleanup);
        outputStream.once('close', cleanup);
        settled = true;
        resolve({ ...common, stream: outputStream });
        return;
      }

      (async () => {
        try {
          const chunks = [];
          for await (const chunk of outputStream) chunks.push(chunk);
          cleanup();
          if (settled) return;
          settled = true;
          resolve({ ...common, buffer: Buffer.concat(chunks) });
        } catch (error) {
          fail(error);
        }
      })();
    });
    request.on('error', fail);
    try {
      // Gövde yalnızca POST/PUT gibi metotlarda gönderilir; GET çağrıları
      // options.body vermediği için davranış değişmez.
      request.end(options.body);
    } catch (error) {
      fail(error);
    }
  });
}

async function requestBuffer(input, options = {}, redirectCount = 0) {
  return requestRemote(input, options, redirectCount, createRequestBudget(options), 'buffer');
}

async function safeFetchText(input, options) {
  const result = await requestBuffer(input, options);
  return { ...result, text: result.buffer.toString(options?.encoding || 'utf8') };
}

async function safeFetchJson(input, options) {
  const result = await safeFetchText(input, { ...options, accept: 'application/json' });
  try {
    return { ...result, data: JSON.parse(result.text) };
  } catch {
    throw createAppError('XTREAM_CONNECTION_FAILED', 'Uzak sunucu geçerli JSON döndürmedi');
  }
}

async function requestStream(input, options = {}, redirectCount = 0) {
  return requestRemote(input, options, redirectCount, createRequestBudget(options), 'stream');
}

module.exports = {
  requestBuffer,
  safeFetchText,
  safeFetchJson,
  requestStream,
  parseRemoteUrl,
  isBlockedIp,
  resolvePublicAddress,
  createPinnedLookup,
};
