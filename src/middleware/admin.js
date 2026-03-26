const { createAppError } = require('../utils/AppError');
const db = require('../config/database');

async function adminMiddleware(req, _res, next) {
  try {
    const user = await db('users').where({ id: req.userId }).first();
    if (!user || !user.is_admin) {
      return next(createAppError('FORBIDDEN', 'Admin yetkisi gereklidir'));
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = adminMiddleware;
