const dns = require('dns').promises;
const http = require('http');
const https = require('https');
const net = require('net');
const zlib = require('zlib');
const ipaddr = require('ipaddr.js');
const config = require('../config');
const { createAppError } = require('./AppError');

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

function normalizeIp(address) {
  const parsed = ipaddr.parse(address);
  return parsed.kind() === 'ipv6' && parsed.isIPv4MappedAddress() ? parsed.toIPv4Address() : parsed;
}

function isBlockedIp(address) {
  if (config.allowPrivateNetworkUrls) return false;
  try {
    return normalizeIp(address).range() !== 'unicast';
  } catch {
    return true;
  }
}

async function resolvePublicAddress(hostname) {
  const addresses = net.isIP(hostname)
    ? [{ address: hostname, family: net.isIP(hostname) }]
    : await dns.lookup(hostname, { all: true, verbatim: true });

  if (!addresses.length || addresses.some(({ address }) => isBlockedIp(address))) {
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

async function requestBuffer(input, options = {}, redirectCount = 0) {
  const url = parseRemoteUrl(input);
  const resolved = await resolvePublicAddress(url.hostname);
  const maxBytes = options.maxBytes || 10 * 1024 * 1024;
  const timeoutMs = options.timeoutMs || 30_000;

  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
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

    const timer = setTimeout(() => request.destroy(new Error('REMOTE_TIMEOUT')), timeoutMs);
    request.on('response', (response) => {
      if (REDIRECT_CODES.has(response.statusCode) && response.headers.location) {
        response.resume();
        clearTimeout(timer);
        if (redirectCount >= MAX_REDIRECTS) {
          reject(createAppError('VALIDATION_ERROR', 'Çok fazla yönlendirme alındı'));
          return;
        }
        const redirected = new URL(response.headers.location, url).toString();
        requestBuffer(redirected, options, redirectCount + 1).then(resolve, reject);
        return;
      }

      const declaredLength = Number(response.headers['content-length']);
      if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        response.destroy();
        clearTimeout(timer);
        reject(createAppError('VALIDATION_ERROR', 'Uzak içerik izin verilen boyutu aşıyor'));
        return;
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        clearTimeout(timer);
        reject(createAppError('XTREAM_CONNECTION_FAILED', `Uzak sunucu HTTP ${response.statusCode} döndürdü`));
        return;
      }

      if ((options.method || 'GET') === 'HEAD') {
        response.resume();
        clearTimeout(timer);
        resolve({ status: response.statusCode, headers: response.headers, buffer: Buffer.alloc(0), url: url.toString() });
        return;
      }

      const stream = decompressedStream(response);
      const chunks = [];
      let received = 0;
      stream.on('data', (chunk) => {
        received += chunk.length;
        if (received > maxBytes) {
          stream.destroy(createAppError('VALIDATION_ERROR', 'Uzak içerik izin verilen boyutu aşıyor'));
          return;
        }
        chunks.push(chunk);
      });
      stream.on('end', () => {
        clearTimeout(timer);
        resolve({ status: response.statusCode, headers: response.headers, buffer: Buffer.concat(chunks), url: url.toString() });
      });
      stream.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    request.on('error', (error) => {
      clearTimeout(timer);
      if (error.message === 'REMOTE_TIMEOUT') {
        reject(createAppError('XTREAM_CONNECTION_FAILED', 'Uzak sunucu zaman aşımına uğradı'));
      } else if (error?.statusCode) reject(error);
      else reject(createAppError('XTREAM_CONNECTION_FAILED', error.message));
    });
    request.end();
  });
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

module.exports = {
  requestBuffer,
  safeFetchText,
  safeFetchJson,
  parseRemoteUrl,
  isBlockedIp,
  resolvePublicAddress,
  createPinnedLookup,
};
