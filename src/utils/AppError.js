/**
 * Custom application error class with error code and HTTP status code.
 */
class AppError extends Error {
  /**
   * @param {string} code - Application error code (e.g. 'VALIDATION_ERROR')
   * @param {string} message - Human-readable error message
   * @param {number} statusCode - HTTP status code
   */
  constructor(code, message, statusCode) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Error code to HTTP status mapping from design doc.
 */
const ERROR_CODES = {
  VALIDATION_ERROR: { statusCode: 400, defaultMessage: 'Geçersiz istek parametreleri' },
  INVALID_CREDENTIALS: { statusCode: 401, defaultMessage: 'Hatalı giriş bilgileri' },
  TOKEN_EXPIRED: { statusCode: 401, defaultMessage: 'JWT token süresi dolmuş' },
  FORBIDDEN: { statusCode: 403, defaultMessage: 'Bu kaynağa erişim yetkiniz yok' },
  NOT_FOUND: { statusCode: 404, defaultMessage: 'Kaynak bulunamadı' },
  XTREAM_CONNECTION_FAILED: { statusCode: 502, defaultMessage: 'Xtream API bağlantı hatası' },
  XTREAM_AUTH_FAILED: { statusCode: 502, defaultMessage: 'Xtream API kimlik doğrulama hatası' },
  EPG_FETCH_FAILED: { statusCode: 502, defaultMessage: 'EPG kaynağı erişim hatası' },
  IMPORT_FAILED: { statusCode: 500, defaultMessage: 'İçe aktarım sırasında beklenmeyen hata' },
  INTERNAL_ERROR: { statusCode: 500, defaultMessage: 'Beklenmeyen bir hata oluştu' },
};

/**
 * Factory: create an AppError from a known error code.
 * @param {string} code - One of the ERROR_CODES keys
 * @param {string} [message] - Optional custom message (falls back to default)
 * @returns {AppError}
 */
function createAppError(code, message) {
  const entry = ERROR_CODES[code];
  if (!entry) {
    return new AppError('INTERNAL_ERROR', message || ERROR_CODES.INTERNAL_ERROR.defaultMessage, 500);
  }
  return new AppError(code, message || entry.defaultMessage, entry.statusCode);
}

module.exports = { AppError, ERROR_CODES, createAppError };
