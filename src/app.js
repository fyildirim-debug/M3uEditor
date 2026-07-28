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
    logger.info({ requestId: req.id, method: req.method, path: req.originalUrl, status: res.statusCode, durationMs: Date.now() - startedAt }, 'Request completed');
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
  skip: (req) => ['/logout', '/profile'].includes(req.path),
});

// Refresh attempts are limited independently from the other auth operations.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
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

// General rate limiting
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

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
app.use('/api/admin', require('./routes/admin'));

// Client-side routing: serve index.html for non-API routes
// 404 handler for unknown API routes
app.use(notFound);

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
