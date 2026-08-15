const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;
const config = require('./config');
const db = require('./config/database');
const logger = require('./config/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { redactUrl } = require('./utils/urls');

const app = express();

// Security headers
app.set('trust proxy', process.env.TRUST_PROXY || 1);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'http:', 'https:'],
      connectSrc: ["'self'", 'http:', 'https:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin(origin, callback) {
    if (!origin || (!config.isProduction && config.corsOrigins.length === 0) || config.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
}));

app.use((req, res, next) => {
  req.id = req.get('x-request-id') || crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  const startedAt = Date.now();
  res.on('finish', () => {
    logger.info({ requestId: req.id, method: req.method, path: redactUrl(req.originalUrl), status: res.statusCode, durationMs: Date.now() - startedAt }, 'Request completed');
  });
  next();
});

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: { code: 'RATE_LIMITED', message: 'Çok fazla istek. Lütfen 15 dakika sonra tekrar deneyin.' } },
  standardHeaders: true,
  legacyHeaders: false,
  // `/refresh` has its own limiter (refreshLimiter) mounted before this one.
  // Leaving it in here as well meant the stricter of the two won and a session
  // refreshed on every page load ran into the 20-request ceiling meant for
  // login and password operations.
  skip: (req) => ['/logout', '/profile', '/refresh'].includes(req.path),
});

// Refresh attempts are limited independently from the other auth operations.
//
// The SPA refreshes the session on every page load, so a ceiling of 10 per 15
// minutes counted legitimate navigation as abuse: the eleventh page load of a
// working session answered 429. What is worth limiting here is *guessing* a
// refresh token, so successful refreshes are not counted and the ceiling
// applies to failures only. A success additionally rotates the token, which
// bounds replay on its own.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  skipSuccessfulRequests: true,
  message: { error: { code: 'RATE_LIMITED', message: 'Çok fazla oturum yenileme isteği. Lütfen 15 dakika sonra tekrar deneyin.' } },
  standardHeaders: true,
  legacyHeaders: false,
});

// Password-protected shares perform an expensive bcrypt comparison on failures.
const sharedPlaylistLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: { code: 'RATE_LIMITED', message: 'Bu paylaşım bağlantısı için çok fazla istek yapıldı. Lütfen daha sonra tekrar deneyin.' } },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator(req) {
    const tokenHash = crypto.createHash('sha256').update(String(req.params.token || '')).digest('hex');
    return `${ipKeyGenerator(req.ip)}:${tokenHash}`;
  },
});

const xtreamPlayerPaths = ['/player_api.php', '/xmltv.php', '/get.php', '/live', '/movie', '/series'];

function xtreamUsername(req) {
  if (typeof req.xtreamLimiterUsername === 'string') return req.xtreamLimiterUsername;
  if (typeof req.query.username === 'string') return req.query.username;
  const match = req.path.match(/^\/(?:live|movie|series)\/([^/]+)/);
  if (!match) return '';
  try { return decodeURIComponent(match[1]); } catch (_error) { return ''; }
}

function xtreamLimiterKey(req) {
  const usernameHash = crypto.createHash('sha256').update(xtreamUsername(req)).digest('hex');
  return `${ipKeyGenerator(req.ip)}:${usernameHash}`;
}

// IPTV oynaticilari bir playlist yuklerken kanal basina istek atar: FyPlayer,
// TiviMate ve IPTV Smarters her kanal icin ayri bir get_short_epg cagirir, yani
// 500 kanallik bir listede tek acilis 500+ istek demektir. Limit bu davranisi
// karsilayacak kadar yuksek ve kullanici adi/IP basina izole olmali; brute
// force korumasi asagidaki xtreamFailureLimiter'in isi.
const xtreamPlayerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.xtream.playerRateLimit,
  message: { error: { code: 'RATE_LIMITED', message: 'Xtream istemcisi için çok fazla istek yapıldı. Lütfen daha sonra tekrar deneyin.' } },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: xtreamLimiterKey,
});

// Basarili player trafigi bu sayactan dusulur; geriye yalnizca protokol
// duzeyindeki kimlik hatalari kalir (auth:0 donen HTTP 200 dahil).
//
// DIKKAT: skipSuccessfulRequests sayaci once artirip istek bitince geri alir.
// Oynaticilar acilista onlarca istegi ayni anda gonderdigi icin sayac, hepsi
// basarili olsa bile gecici olarak paralel istek sayisi kadar sisiyor; tavan
// dar tutulursa mesru istemci 429 aliyor (30 paralel istekte 15'i reddediliyordu).
// Bu yuzden tavan burst'u kaldiracak kadar genis: kullanici adi 96 bit rastgele
// oldugu icin bu deger brute force acisindan hala anlamsiz kucuklukte.
const xtreamFailureLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.xtream.failureRateLimit,
  message: { error: { code: 'RATE_LIMITED', message: 'Çok fazla başarısız Xtream kimlik doğrulama denemesi yapıldı.' } },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: xtreamLimiterKey,
  skipSuccessfulRequests: true,
  requestWasSuccessful(_req, res) {
    return res.locals.xtreamAuthFailed !== true;
  },
});

function redactXtreamCredentials(req, _res, next) {
  try {
    const url = new URL(req.originalUrl, 'http://local.invalid');
    const pathUsername = url.pathname.match(/^\/(?:live|movie|series)\/([^/]+)/)?.[1];
    req.xtreamLimiterUsername = url.searchParams.get('username') || (pathUsername ? decodeURIComponent(pathUsername) : '');
    if (url.searchParams.has('username')) url.searchParams.set('username', '[REDACTED]');
    if (url.searchParams.has('password')) url.searchParams.set('password', '[REDACTED]');
    url.pathname = url.pathname.replace(
      /^(\/(?:live|movie|series)\/)[^/]+\/[^/]+\//,
      '$1[REDACTED]/[REDACTED]/'
    );
    req.originalUrl = `${url.pathname}${url.search}`;
  } catch (_error) {
    req.originalUrl = req.path;
  }
  next();
}

// General rate limiting
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  message: { error: { code: 'RATE_LIMITED', message: 'Çok fazla istek gönderildi. Lütfen bir dakika sonra tekrar deneyin.' } },
  standardHeaders: true,
  legacyHeaders: false,
  // Xtream player yollarinin kendi limitleri var (xtreamPlayerLimiter +
  // xtreamFailureLimiter). Ikisi ust uste binerse dar olan kazanir: 200/dk,
  // bir oynaticinin acilistaki kanal-basina EPG taramasini 429'a dusurur ve
  // ozel limiterin genis penceresi anlamsizlasir.
  skip: (req) => xtreamPlayerPaths.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`)),
});

app.use(xtreamPlayerPaths, redactXtreamCredentials, xtreamPlayerLimiter, xtreamFailureLimiter);
app.use(generalLimiter);
app.use('/api/auth/refresh', refreshLimiter);
app.use('/api/shared/:token', sharedPlaylistLimiter);

app.use(express.json({ limit: config.limits.jsonBody }));

app.use('/logos', express.static(config.uploadDir, {
  dotfiles: 'deny',
  fallthrough: false,
  immutable: true,
  maxAge: '30d',
  setHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
  },
}));
// Serve static files from public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health check
app.get('/health', async (req, res) => {
  try {
    await db.raw('SELECT 1');
    res.json({ status: 'ok', database: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, 'Health check failed');
    res.status(503).json({ status: 'degraded', database: 'unavailable', timestamp: new Date().toISOString() });
  }
});

// Routes
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api', require('./routes/channels'));
app.use('/api', require('./routes/categories'));
app.use('/api', require('./routes/import'));
app.use('/api', require('./routes/epg'));
app.use('/api', require('./routes/export'));
app.use('/api', require('./routes/playlists'));
app.use('/api', require('./routes/filterRules'));
app.use('/api', require('./routes/sources'));
app.use('/api', require('./routes/views'));
app.use('/api', require('./routes/backups'));
app.use('/api', require('./routes/streamHealth'));
app.use('/api', require('./routes/epgLibrary'));
app.use('/api', require('./routes/ai'));
app.use('/api/admin', require('./routes/admin'));
app.use('/', require('./routes/xtreamOutput'));

// Client-side routing: serve index.html for non-API routes
// 404 handler for unknown API routes
app.use(notFound);

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
