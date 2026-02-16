const authService = require('../services/AuthService');
const { createAppError } = require('../utils/AppError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

/**
 * POST /api/auth/register
 */
async function register(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw createAppError('VALIDATION_ERROR', 'E-posta ve şifre gereklidir');
    }

    if (!EMAIL_REGEX.test(email)) {
      throw createAppError('VALIDATION_ERROR', 'Geçersiz e-posta formatı');
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      throw createAppError('VALIDATION_ERROR', `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır`);
    }

    const result = await authService.register(email, password);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw createAppError('VALIDATION_ERROR', 'E-posta ve şifre gereklidir');
    }

    if (!EMAIL_REGEX.test(email)) {
      throw createAppError('VALIDATION_ERROR', 'Geçersiz e-posta formatı');
    }

    const result = await authService.login(email, password);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login };
