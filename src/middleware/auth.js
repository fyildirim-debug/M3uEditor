const authService = require('../services/AuthService');
const { createAppError } = require('../utils/AppError');

/**
 * Auth middleware — extracts Bearer token from Authorization header,
 * verifies it, and sets req.userId.
 */
async function authMiddleware(req, _res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(createAppError('INVALID_CREDENTIALS', 'Token bulunamadı'));
  }

  const token = header.slice(7);

  try {
    const { userId, sessionId } = authService.verifyToken(token);
    await authService.verifySession(userId, sessionId);
    req.userId = userId;
    req.sessionId = sessionId;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = authMiddleware;
