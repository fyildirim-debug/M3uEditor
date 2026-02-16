const { AppError, ERROR_CODES } = require('../utils/AppError');

/**
 * Middleware for unknown routes — returns 404 NOT_FOUND.
 * Must be mounted after all route definitions.
 */
function notFound(req, res, _next) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `${req.method} ${req.originalUrl} bulunamadı`,
    },
  });
}

/**
 * Global error handler middleware.
 * - AppError instances → use their code & statusCode
 * - Generic errors → INTERNAL_ERROR 500
 */
function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
  }

  // Generic / unexpected error
  console.error('Unhandled error:', err);
  const statusCode = 500;
  const code = 'INTERNAL_ERROR';
  const message = ERROR_CODES.INTERNAL_ERROR.defaultMessage;

  res.status(statusCode).json({
    error: { code, message },
  });
}

module.exports = { errorHandler, notFound };
