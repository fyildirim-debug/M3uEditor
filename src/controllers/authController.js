const authService = require('../services/AuthService');
const config = require('../config');
const { createAppError } = require('../utils/AppError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 128;
const COOKIE_NAME = 'm3u_refresh';

function metadata(req) {
  return { userAgent: req.get('user-agent'), ipAddress: req.ip };
}

function parseCookies(req) {
  return String(req.headers.cookie || '').split(';').reduce((cookies, pair) => {
    const separator = pair.indexOf('=');
    if (separator > -1) {
      try {
        cookies[pair.slice(0, separator).trim()] = decodeURIComponent(pair.slice(separator + 1));
      } catch (_error) {
        // Ignore malformed percent-encoding instead of turning a bad cookie into a 500 response.
      }
    }
    return cookies;
  }, {});
}

function setRefreshCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: config.isProduction, sameSite: 'strict', path: '/api/auth' });
}

function validateCredentials(email, password) {
  if (!email || !password) throw createAppError('VALIDATION_ERROR', 'E-posta ve şifre gerekli');
  if (typeof email !== 'string' || email.length > 320 || !EMAIL_REGEX.test(email)) {
    throw createAppError('VALIDATION_ERROR', 'Geçersiz e-posta biçimi');
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw createAppError('VALIDATION_ERROR', `Şifre ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} karakter arasında olmalı`);
  }
}

function publicAuthResult(result) {
  return { user: result.user, token: result.token };
}

async function register(req, res, next) {
  try {
    const { email, password } = req.body;
    validateCredentials(email, password);
    const result = await authService.register(email, password, metadata(req));
    setRefreshCookie(res, result.refreshToken);
    res.status(201).json(publicAuthResult(result));
  } catch (error) { next(error); }
}

async function registrationStatus(_req, res, next) {
  try {
    res.json({ allowed: await authService.isRegistrationAllowed() });
  } catch (error) { next(error); }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string' || !EMAIL_REGEX.test(email)) {
      throw createAppError('VALIDATION_ERROR', 'Geçerli e-posta ve şifre gerekli');
    }
    const result = await authService.login(email, password, metadata(req));
    setRefreshCookie(res, result.refreshToken);
    res.json(publicAuthResult(result));
  } catch (error) { next(error); }
}

async function refreshToken(req, res, next) {
  try {
    const token = parseCookies(req)[COOKIE_NAME] || req.body?.refreshToken;
    const result = await authService.refreshAccessToken(token, metadata(req));
    setRefreshCookie(res, result.refreshToken);
    res.json(publicAuthResult(result));
  } catch (error) {
    clearRefreshCookie(res);
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    await authService.logout({
      userId: req.userId,
      sessionId: req.sessionId,
      refreshToken: parseCookies(req)[COOKIE_NAME],
    });
    clearRefreshCookie(res);
    res.json({ success: true });
  } catch (error) { next(error); }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    validateCredentials('valid@example.com', newPassword);
    if (!currentPassword || typeof currentPassword !== 'string') throw createAppError('VALIDATION_ERROR', 'Mevcut şifre gerekli');
    const result = await authService.changePassword(req.userId, currentPassword, newPassword);
    clearRefreshCookie(res);
    res.json(result);
  } catch (error) { next(error); }
}

async function changeEmail(req, res, next) {
  try {
    const { password, newEmail } = req.body;
    if (!password || !newEmail || typeof newEmail !== 'string' || !EMAIL_REGEX.test(newEmail)) {
      throw createAppError('VALIDATION_ERROR', 'Geçerli e-posta ve şifre gerekli');
    }
    res.json(await authService.changeEmail(req.userId, password, newEmail));
  } catch (error) { next(error); }
}

async function deleteAccount(req, res, next) {
  try {
    if (!req.body?.password) throw createAppError('VALIDATION_ERROR', 'Şifre gerekli');
    await authService.deleteAccount(req.userId, req.body.password);
    clearRefreshCookie(res);
    res.json({ success: true });
  } catch (error) { next(error); }
}

async function getProfile(req, res, next) {
  try { res.json(await authService.getProfile(req.userId)); } catch (error) { next(error); }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email)) throw createAppError('VALIDATION_ERROR', 'Geçerli e-posta gerekli');
    res.json(await authService.forgotPassword(email));
  } catch (error) { next(error); }
}

async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    validateCredentials('valid@example.com', password);
    if (!token || typeof token !== 'string') throw createAppError('VALIDATION_ERROR', 'Sıfırlama belirteci gerekli');
    const result = await authService.resetPassword(token, password);
    clearRefreshCookie(res);
    res.json(result);
  } catch (error) { next(error); }
}

module.exports = {
  register,
  registrationStatus,
  login,
  refreshToken,
  logout,
  changePassword,
  changeEmail,
  deleteAccount,
  getProfile,
  forgotPassword,
  resetPassword,
};
