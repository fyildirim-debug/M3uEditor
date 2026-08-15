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
  allowRegistration: process.env.ALLOW_REGISTRATION !== 'false',
  allowPrivateNetworkUrls: process.env.ALLOW_PRIVATE_NETWORK_URLS === 'true',
  corsOrigins: (process.env.CORS_ORIGIN || process.env.APP_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  uploadDir: process.env.UPLOAD_DIR || require('path').join(__dirname, '..', '..', 'data', 'logos'),
  // Asistan ekleri logolarla ayni veri biriminde ama ayri klasorde durur:
  // logo klasoru web'den servis edilir, ekler yalnizca kimlik dogrulamali
  // indirme ucundan okunur.
  aiAttachmentDir: process.env.AI_ATTACHMENT_DIR
    || require('path').join(require('path').dirname(process.env.UPLOAD_DIR || require('path').join(__dirname, '..', '..', 'data', 'logos')), 'ai-attachments'),
  limits: {
    jsonBody: process.env.MAX_JSON_BODY || '25mb',
    m3uBytes: parsePositiveInteger(process.env.MAX_M3U_BYTES, 20 * 1024 * 1024),
    epgBytes: parsePositiveInteger(process.env.MAX_EPG_BYTES, 100 * 1024 * 1024),
    xtreamBytes: parsePositiveInteger(process.env.MAX_XTREAM_BYTES, 256 * 1024 * 1024),
  },
  ai: {
    // Sohbet mesajinin ust siniri. Eskiden 8.000 karakterdi ve yapistirilan
    // listeler reddediliyordu; artik pratikte sinirsiz: esigi asan metin
    // otomatik olarak eke donusturulur ve modele onizleme + arac erisimi verilir.
    maxMessageChars: parsePositiveInteger(process.env.AI_MAX_MESSAGE_CHARS, 1_000_000),
    // Bu uzunlugun ustundeki mesaj govdesi modele oldugu gibi gitmez; ek dosya
    // olarak saklanip onizlemesi gonderilir (baglam penceresini korur).
    inlineMessageChars: parsePositiveInteger(process.env.AI_INLINE_MESSAGE_CHARS, 12_000),
    attachmentBytes: parsePositiveInteger(process.env.AI_ATTACHMENT_MAX_BYTES, 20 * 1024 * 1024),
    attachmentQuotaBytes: parsePositiveInteger(process.env.AI_ATTACHMENT_QUOTA_BYTES, 200 * 1024 * 1024),
    // Zamanlanmis gorevlerde tek turda izin verilen en dusuk aralik.
    minTaskIntervalMinutes: parsePositiveInteger(process.env.AI_MIN_TASK_INTERVAL_MINUTES, 15),
  },
  imports: {
    maxConcurrent: Math.min(parsePositiveInteger(process.env.MAX_CONCURRENT_IMPORTS, 4), 64),
    jobTtlMs: parsePositiveInteger(process.env.IMPORT_JOB_TTL_MS, 10 * 60_000),
  },
  xtream: {
    totalTimeoutMs: parsePositiveInteger(process.env.XTREAM_TOTAL_TIMEOUT_MS, 120_000),
    categoryConcurrency: Math.min(parsePositiveInteger(process.env.XTREAM_CATEGORY_CONCURRENCY, 8), 32),
    typeConcurrency: Math.min(parsePositiveInteger(process.env.XTREAM_TYPE_CONCURRENCY, 2), 3),
    // 15 dakikalik pencerede kullanici adi+IP basina izin verilen player
    // istegi. Oynaticilar kanal basina bir get_short_epg atar, yani tek acilis
    // liste buyuklugu kadar istek demektir; 20.000 hem 5-10 bin kanallik
    // gercek listelerin birkac kez yenilenmesini kaldirir hem de sonsuz
    // degildir. Kimlik dogrulamasi basarisiz trafigi ayrica
    // xtreamFailureLimiter kesiyor.
    playerRateLimit: parsePositiveInteger(process.env.XTREAM_PLAYER_RATE_LIMIT, 20_000),
    // Basarisiz Xtream kimlik dogrulamasi tavani. Oynaticilarin paralel
    // istekleri sayaci gecici olarak sisirdigi icin burst'u kaldiracak kadar
    // genis; kullanici adi 96 bit rastgele oldugundan brute force riski yok.
    failureRateLimit: parsePositiveInteger(process.env.XTREAM_FAILURE_RATE_LIMIT, 200),
  },
};

/**
 * Dışarıya verilen her mutlak adresin (paylaşım linki, yüklenen logo, XMLTV
 * ikonu, Xtream çıkışı) tek kaynağı. Sondaki eğik çizgi normalize edilir.
 * Okuma anında değerlendirilir, böylece çalışma anında değişen ortam
 * değişkenini de yansıtır.
 */
Object.defineProperty(config, 'appUrl', {
  enumerable: true,
  get() {
    return String(process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  },
});

module.exports = config;
