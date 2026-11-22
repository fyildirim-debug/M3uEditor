const request = require('supertest');
const express = require('express');
const { AppError, createAppError, ERROR_CODES } = require('../../../src/utils/AppError');
const { errorHandler, notFound } = require('../../../src/middleware/errorHandler');

/**
 * Helper: build a minimal Express app that throws the given error on GET /error,
 * with notFound + errorHandler mounted.
 */
function buildApp(err) {
  const app = express();
  app.get('/ok', (_req, res) => res.json({ ok: true }));
  if (err) {
    app.get('/error', (_req, _res, next) => next(err));
  }
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

// ─── AppError class ──────────────────────────────────────────────────────────

describe('AppError', () => {
  test('extends Error with code and statusCode', () => {
    const err = new AppError('NOT_FOUND', 'Kaynak bulunamadı', 404);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.name).toBe('AppError');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Kaynak bulunamadı');
    expect(err.statusCode).toBe(404);
  });

  test('has a proper stack trace', () => {
    const err = new AppError('INTERNAL_ERROR', 'fail', 500);
    expect(err.stack).toBeDefined();
  });
});

// ─── createAppError factory ──────────────────────────────────────────────────

describe('createAppError', () => {
  test('creates error with correct status for each known code', () => {
    for (const [code, { statusCode, defaultMessage }] of Object.entries(ERROR_CODES)) {
      const err = createAppError(code);
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe(code);
      expect(err.statusCode).toBe(statusCode);
      expect(err.message).toBe(defaultMessage);
    }
  });

  test('allows custom message override', () => {
    const err = createAppError('VALIDATION_ERROR', 'E-posta geçersiz');
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('E-posta geçersiz');
  });

  test('falls back to INTERNAL_ERROR for unknown code', () => {
    const err = createAppError('UNKNOWN_CODE', 'something broke');
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe('something broke');
  });
});

// ─── ERROR_CODES mapping ────────────────────────────────────────────────────

describe('ERROR_CODES', () => {
  test('contains all expected error codes from design doc', () => {
    const expectedCodes = [
      'VALIDATION_ERROR', 'INVALID_CREDENTIALS', 'TOKEN_EXPIRED',
      'FORBIDDEN', 'NOT_FOUND', 'DUPLICATE_CHANNEL', 'XTREAM_CONNECTION_FAILED',
      'XTREAM_AUTH_FAILED', 'EPG_FETCH_FAILED', 'IMPORT_FAILED',
      'IMPORT_IN_PROGRESS', 'IMPORT_CANCELLED', 'IMPORT_CAPACITY_REACHED',
      'INTERNAL_ERROR', 'CONFLICT', 'DATABASE_UNAVAILABLE', 'HEALTH_SCAN_CAPACITY_REACHED',
    ];
    expect(Object.keys(ERROR_CODES).sort()).toEqual(expectedCodes.sort());
  });

  test.each([
    ['DUPLICATE_CHANNEL', 409],
    ['IMPORT_IN_PROGRESS', 409],
    ['IMPORT_CANCELLED', 499],
    ['IMPORT_CAPACITY_REACHED', 503],
    ['CONFLICT', 409],
    ['DATABASE_UNAVAILABLE', 503],
    ['HEALTH_SCAN_CAPACITY_REACHED', 503],
  ])('maps %s to HTTP %i', (code, statusCode) => {
    expect(ERROR_CODES[code].statusCode).toBe(statusCode);
  });

  test.each([
    ['VALIDATION_ERROR', 400],
    ['INVALID_CREDENTIALS', 401],
    ['TOKEN_EXPIRED', 401],
    ['FORBIDDEN', 403],
    ['NOT_FOUND', 404],
    ['XTREAM_CONNECTION_FAILED', 502],
    ['XTREAM_AUTH_FAILED', 502],
    ['EPG_FETCH_FAILED', 502],
    ['IMPORT_FAILED', 500],
    ['INTERNAL_ERROR', 500],
  ])('%s maps to HTTP %i', (code, expectedStatus) => {
    expect(ERROR_CODES[code].statusCode).toBe(expectedStatus);
  });
});

// ─── errorHandler middleware ─────────────────────────────────────────────────

describe('errorHandler middleware', () => {
  test('returns consistent JSON format for AppError', async () => {
    const app = buildApp(new AppError('VALIDATION_ERROR', 'Geçersiz e-posta', 400));
    const res = await request(app).get('/error');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'Geçersiz e-posta' },
    });
  });

  test('returns 500 INTERNAL_ERROR for generic Error', async () => {
    const app = buildApp(new Error('unexpected'));
    const res = await request(app).get('/error');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: ERROR_CODES.INTERNAL_ERROR.defaultMessage },
    });
  });

  test('preserves statusCode from AppError for each error code', async () => {
    for (const [code, { statusCode }] of Object.entries(ERROR_CODES)) {
      const app = buildApp(new AppError(code, 'test', statusCode));
      const res = await request(app).get('/error');
      expect(res.status).toBe(statusCode);
      expect(res.body.error.code).toBe(code);
    }
  });

  test('does not leak internal error details for generic errors', async () => {
    const app = buildApp(new Error('secret db password exposed'));
    const res = await request(app).get('/error');

    expect(res.body.error.message).not.toContain('secret');
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });

  test('maps malformed JSON body errors to 400 VALIDATION_ERROR', async () => {
    const parseError = Object.assign(new SyntaxError('Unexpected token'), { type: 'entity.parse.failed', status: 400 });
    const app = buildApp(parseError);
    const res = await request(app).get('/error');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'İstek gövdesi geçerli JSON içermiyor' },
    });
  });

  test('maps oversized body errors to 413 without exposing internals', async () => {
    const sizeError = Object.assign(new Error('request entity too large'), { type: 'entity.too.large', status: 413 });
    const app = buildApp(sizeError);
    const res = await request(app).get('/error');

    expect(res.status).toBe(413);
    expect(res.body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'İstek gövdesi izin verilen boyutu aşıyor' },
    });
  });
});

// ─── notFound middleware ─────────────────────────────────────────────────────

describe('notFound middleware', () => {
  test('returns 404 with NOT_FOUND code for unknown GET route', async () => {
    const app = buildApp();
    const res = await request(app).get('/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toContain('/does-not-exist');
  });

  test('returns 404 for unknown POST route', async () => {
    const app = buildApp();
    const res = await request(app).post('/nope');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toContain('POST');
  });

  test('does not intercept valid routes', async () => {
    const app = buildApp();
    const res = await request(app).get('/ok');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

// ─── database error mapping ──────────────────────────────────────────────────

describe('database error mapping', () => {
  function pgError(code, message) {
    return Object.assign(new Error(message), { code });
  }

  function appWithParam(err) {
    const app = express();
    app.get('/items/:id', (_req, _res, next) => next(err));
    app.get('/search', (_req, _res, next) => next(err));
    app.use(errorHandler);
    return app;
  }

  test('maps an invalid UUID in a route parameter to 404 and elsewhere to 400', async () => {
    const err = pgError('22P02', 'invalid input syntax for type uuid: "not-a-uuid"');
    const fromParam = await request(appWithParam(err)).get('/items/not-a-uuid');
    expect(fromParam.status).toBe(404);
    expect(fromParam.body.error.code).toBe('NOT_FOUND');

    const fromQuery = await request(appWithParam(err)).get('/search?id=not-a-uuid');
    expect(fromQuery.status).toBe(400);
    expect(fromQuery.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('maps unique and foreign key violations to conflict / validation errors', async () => {
    const unique = await request(buildApp(pgError('23505', 'duplicate key value violates unique constraint'))).get('/error');
    expect(unique.status).toBe(409);
    expect(unique.body.error.code).toBe('CONFLICT');

    const missingRef = await request(buildApp(pgError('23503', 'insert or update on table "channels" violates foreign key constraint'))).get('/error');
    expect(missingRef.status).toBe(400);
    expect(missingRef.body.error.code).toBe('VALIDATION_ERROR');

    const stillReferenced = await request(buildApp(pgError('23503', 'update or delete on table "categories" violates foreign key constraint'))).get('/error');
    expect(stillReferenced.status).toBe(409);
    expect(stillReferenced.body.error.code).toBe('CONFLICT');
  });

  test.each([
    ['ECONNREFUSED', Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' })],
    ['ENOTFOUND', Object.assign(new Error('getaddrinfo ENOTFOUND db'), { code: 'ENOTFOUND' })],
    ['57P01', pgError('57P01', 'terminating connection due to administrator command')],
    ['knex pool timeout', Object.assign(new Error('Knex: Timeout acquiring a connection. The pool is probably full.'), { name: 'KnexTimeoutError' })],
    ['AggregateError', new AggregateError([Object.assign(new Error('x'), { code: 'ECONNREFUSED' })], 'all failed')],
  ])('maps %s to 503 DATABASE_UNAVAILABLE', async (_label, err) => {
    const res = await request(buildApp(err)).get('/error');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('DATABASE_UNAVAILABLE');
    expect(res.body.error.message).toMatch(/Veritabanına ulaşılamıyor/);
  });

  test('does not leak a share token from the path into the error log', async () => {
    const logger = require('../../../src/config/logger');
    const spy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    const app = express();
    app.get('/api/shared/:token', (_req, _res, next) => next(new Error('boom')));
    app.use(errorHandler);

    await request(app).get('/api/shared/super-secret-token');

    const logged = spy.mock.calls[0][0].path;
    expect(logged).toBe('/api/shared/REDACTED');
    spy.mockRestore();
  });
});

describe('describeDatabaseError', () => {
  const { describeDatabaseError } = require('../../../src/utils/dbErrors');

  test('explains the most common boot failures in plain language', () => {
    const connection = { host: 'db', port: 5432, database: 'm3u' };
    expect(describeDatabaseError(Object.assign(new Error('x'), { code: 'ECONNREFUSED' }), connection)).toMatch(/db:5432\/m3u/);
    expect(describeDatabaseError(Object.assign(new Error('x'), { code: '3D000' }), connection)).toMatch(/"m3u" veritabanı yok/);
    expect(describeDatabaseError(Object.assign(new Error('x'), { code: '28P01' }), connection)).toMatch(/DB_USER/);
  });
});
