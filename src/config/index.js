const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const forbiddenSecrets = new Set([
  'dev-secret-key',
  'dev-refresh-secret-key',
  'change-this-secret-in-production',
  'change-me',
  'replace-with-a-long-random-secret',
  'replace-with-another-long-random-secret',
]);

function isLowEntropySecret(value) {
  const compact = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const dictionaryPattern = /^(?:admin|another|change|credential|default|development|encryption|example|jwt|key|long|password|production|random|replace|secret|test|with)+$/;
  const repeatedPattern = /^(.{1,16})\1+$/;

  return new Set(value).size < 8 || repeatedPattern.test(value) || dictionaryPattern.test(compact);
}

function requireProductionSecret(name, value, minimumLength = 32) {
  if (!isProduction) return value;
  const normalizedValue = String(value || '').trim();
  const isPlaceholder = /^(?:replace-with-|BURAYI_DEGISTIR_)/i.test(normalizedValue);
  if (!normalizedValue || normalizedValue.length < minimumLength || forbiddenSecrets.has(normalizedValue) || isPlaceholder || isLowEntropySecret(normalizedValue)) {
    throw new Error(`${name} production ortamında en az ${minimumLength} karakterli, yüksek entropili ve benzersiz bir secret olmalı. Yeni bir değer üretmek için: openssl rand -hex 32`);
  }
  return normalizedValue;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const jwtSecret = requireProductionSecret('JWT_SECRET', process.env.JWT_SECRET || 'dev-secret-key');
const encryptionKey = requireProductionSecret(
  'CREDENTIAL_ENCRYPTION_KEY',
  process.env.CREDENTIAL_ENCRYPTION_KEY || (isProduction ? '' : 'development-only-credential-key')
);
if (isProduction && jwtSecret === encryptionKey) {
  throw new Error('JWT_SECRET ile CREDENTIAL_ENCRYPTION_KEY farklı olmalı. İki bağımsız değer üretmek için her biri adına ayrı ayrı: openssl rand -hex 32');
}

const config = {
  port: parsePositiveInteger(process.env.PORT, 3000),
  nodeEnv,
  isProduction,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'm3u_playlist_editor',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    issuer: process.env.JWT_ISSUER || 'm3u-editor',
    audience: process.env.JWT_AUDIENCE || 'm3u-editor-web',
  },
  credentialEncryptionKey: encryptionKey,
  allowPrivateNetworkUrls: process.env.ALLOW_PRIVATE_NETWORK_URLS === 'true',
  corsOrigins: (process.env.CORS_ORIGIN || process.env.APP_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  uploadDir: process.env.UPLOAD_DIR || require('path').join(__dirname, '..', '..', 'data', 'logos'),
  limits: {
    jsonBody: process.env.MAX_JSON_BODY || '25mb',
    m3uBytes: parsePositiveInteger(process.env.MAX_M3U_BYTES, 20 * 1024 * 1024),
    epgBytes: parsePositiveInteger(process.env.MAX_EPG_BYTES, 100 * 1024 * 1024),
    xtreamBytes: parsePositiveInteger(process.env.MAX_XTREAM_BYTES, 256 * 1024 * 1024),
  },
  xtream: {
    categoryConcurrency: Math.min(parsePositiveInteger(process.env.XTREAM_CATEGORY_CONCURRENCY, 8), 32),
    typeConcurrency: Math.min(parsePositiveInteger(process.env.XTREAM_TYPE_CONCURRENCY, 2), 3),
  },
};

module.exports = config;
