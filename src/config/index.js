const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const forbiddenSecrets = new Set([
  'dev-secret-key',
  'dev-refresh-secret-key',
  'change-this-secret-in-production',
  'change-me',
]);

function requireProductionSecret(name, value, minimumLength = 32) {
  if (!isProduction) return value;
  if (!value || value.length < minimumLength || forbiddenSecrets.has(value)) {
    throw new Error(`${name} must be set to a unique secret of at least ${minimumLength} characters in production`);
  }
  return value;
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
