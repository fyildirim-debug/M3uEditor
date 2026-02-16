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
      'FORBIDDEN', 'NOT_FOUND', 'XTREAM_CONNECTION_FAILED',
      'XTREAM_AUTH_FAILED', 'EPG_FETCH_FAILED', 'IMPORT_FAILED',
      'INTERNAL_ERROR',
    ];
    expect(Object.keys(ERROR_CODES).sort()).toEqual(expectedCodes.sort());
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
