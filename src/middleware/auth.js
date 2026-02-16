const authService = require('../services/AuthService');
const { createAppError } = require('../utils/AppError');

/**
 * Auth middleware — extracts Bearer token from Authorization header,
 * verifies it, and sets req.userId.
 */
function authMiddleware(req, _res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(createAppError('INVALID_CREDENTIALS', 'Token bulunamadı'));
  }

  const token = header.slice(7);

  try {
    const { userId } = authService.verifyToken(token);
    req.userId = userId;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = authMiddleware;
