const { AppError, ERROR_CODES } = require('../utils/AppError');
const logger = require('../config/logger');
const { redactUrl } = require('../utils/urls');
const { isDatabaseUnavailableError } = require('../utils/dbErrors');

/**
 * Middleware for unknown routes — returns 404 NOT_FOUND.
 * Must be mounted after all route definitions.
 */
function notFound(req, res, _next) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `${req.method} ${redactUrl(req.originalUrl)} bulunamadı`,
    },
  });
}

/**
 * Bilinen PostgreSQL hata kodlarini istemci hatasina cevirir. Eskiden hepsi
 * 500 "beklenmeyen hata" donuyordu (ornegin gecersiz UUID iceren bir adres).
 * @returns {{ statusCode: number, code: string, message: string }|null}
 */
function mapDatabaseError(err, req) {
  if (isDatabaseUnavailableError(err)) {
    return { statusCode: 503, code: 'DATABASE_UNAVAILABLE', message: ERROR_CODES.DATABASE_UNAVAILABLE.defaultMessage };
  }
  switch (err?.code) {
    case '22P02': {
      // Gecersiz UUID/sayi bicimi. Deger bir yol parametresinden geliyorsa
      // kaynak yok demektir (404); govde/sorgu dizesinden geliyorsa istek hatali.
      // (Hata middleware'inde req.params artik bos; yol parcalari kullanilir.)
      const message = String(err.message || '');
      const pathOnly = String(req?.originalUrl || '').split('?')[0];
      const fromRouteParam = pathOnly.split('/').filter(Boolean).some((segment) => {
        let value = segment;
        try { value = decodeURIComponent(segment); } catch { /* ham parca kullanilir */ }
        return message.includes(`"${value}"`);
      });
      return fromRouteParam
        ? { statusCode: 404, code: 'NOT_FOUND', message: ERROR_CODES.NOT_FOUND.defaultMessage }
        : { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Geçersiz kimlik veya değer biçimi' };
    }
    case '22001':
    case '22003':
    case '22007':
    case '22008':
    case '23502':
    case '23514':
      return { statusCode: 400, code: 'VALIDATION_ERROR', message: ERROR_CODES.VALIDATION_ERROR.defaultMessage };
    case '23505':
      return { statusCode: 409, code: 'CONFLICT', message: 'Bu kayıt zaten mevcut' };
    case '23503':
      // insert/update: var olmayan bir kayda referans (istek hatali);
      // update/delete: kayit hala baska kayitlarca kullaniliyor (cakisma).
      return /^insert or update/i.test(String(err.message || ''))
        ? { statusCode: 400, code: 'VALIDATION_ERROR', message: 'İlişkili kayıt bulunamadı' }
        : { statusCode: 409, code: 'CONFLICT', message: 'Kayıt başka kayıtlar tarafından kullanılıyor' };
    default:
      return null;
  }
}

/**
 * Global error handler middleware.
 * - AppError instances → use their code & statusCode
 * - Known PostgreSQL / connection errors → mapped client errors or 503
 * - Generic errors → INTERNAL_ERROR 500
 */
function errorHandler(err, req, res, _next) {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: { code: 'VALIDATION_ERROR', message: 'İstek gövdesi izin verilen boyutu aşıyor' },
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'İstek gövdesi geçerli JSON içermiyor' },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
  }

  // Paylasim token'i yolda tasindigi icin ham originalUrl gunluge yazilmaz.
  const path = redactUrl(req.originalUrl);
  const mapped = mapDatabaseError(err, req);
  if (mapped) {
    const level = mapped.statusCode >= 500 ? 'error' : 'warn';
    logger[level]({ err, requestId: req.id, method: req.method, path, pgCode: err.code }, 'Request failed with a database error');
    return res.status(mapped.statusCode).json({
      error: { code: mapped.code, message: mapped.message },
    });
  }

  // Generic / unexpected error
  logger.error({ err, requestId: req.id, method: req.method, path }, 'Unhandled request error');
  const statusCode = 500;
  const code = 'INTERNAL_ERROR';
  const message = ERROR_CODES.INTERNAL_ERROR.defaultMessage;

  return res.status(statusCode).json({
    error: { code, message },
  });
}

module.exports = { errorHandler, notFound, mapDatabaseError };
