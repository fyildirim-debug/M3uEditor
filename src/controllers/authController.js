const authService = require('../services/AuthService');
const { createAppError } = require('../utils/AppError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

async function register(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw createAppError('VALIDATION_ERROR', 'E-posta ve sifre gereklidir');
    if (!EMAIL_REGEX.test(email)) throw createAppError('VALIDATION_ERROR', 'Gecersiz e-posta formati');
    if (password.length < MIN_PASSWORD_LENGTH) throw createAppError('VALIDATION_ERROR', `Sifre en az ${MIN_PASSWORD_LENGTH} karakter olmalidir`);

    const result = await authService.register(email, password);
    res.status(201).json(result);
  } catch (err) { next(err); }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw createAppError('VALIDATION_ERROR', 'E-posta ve sifre gereklidir');
    if (!EMAIL_REGEX.test(email)) throw createAppError('VALIDATION_ERROR', 'Gecersiz e-posta formati');

    const result = await authService.login(email, password);
    res.status(200).json(result);
  } catch (err) { next(err); }
}

async function refreshToken(req, res, next) {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refreshAccessToken(refreshToken);
    res.json(result);
  } catch (err) { next(err); }
}

async function logout(req, res, next) {
  try {
    await authService.logout(req.userId);
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) throw createAppError('VALIDATION_ERROR', 'Mevcut ve yeni sifre gereklidir');
    if (newPassword.length < MIN_PASSWORD_LENGTH) throw createAppError('VALIDATION_ERROR', `Sifre en az ${MIN_PASSWORD_LENGTH} karakter olmalidir`);

    const result = await authService.changePassword(req.userId, currentPassword, newPassword);
    res.json(result);
  } catch (err) { next(err); }
}

async function changeEmail(req, res, next) {
  try {
    const { password, newEmail } = req.body;
    if (!password || !newEmail) throw createAppError('VALIDATION_ERROR', 'Sifre ve yeni e-posta gereklidir');
    if (!EMAIL_REGEX.test(newEmail)) throw createAppError('VALIDATION_ERROR', 'Gecersiz e-posta formati');

    const result = await authService.changeEmail(req.userId, password, newEmail);
    res.json(result);
  } catch (err) { next(err); }
}

async function deleteAccount(req, res, next) {
  try {
    const { password } = req.body;
    if (!password) throw createAppError('VALIDATION_ERROR', 'Sifre gereklidir');

    await authService.deleteAccount(req.userId, password);
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function getProfile(req, res, next) {
  try {
    const profile = await authService.getProfile(req.userId);
    res.json(profile);
  } catch (err) { next(err); }
}

async function getPlan(req, res, next) {
  try {
    const planService = require('../services/PlanService');
    const plan = await planService.getUserPlan(req.userId);
    res.json(plan);
  } catch (err) { next(err); }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) throw createAppError('VALIDATION_ERROR', 'E-posta gereklidir');
    const result = await authService.forgotPassword(email);
    res.json(result);
  } catch (err) { next(err); }
}

async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    if (!token || !password) throw createAppError('VALIDATION_ERROR', 'Token ve sifre gereklidir');
    if (password.length < MIN_PASSWORD_LENGTH) throw createAppError('VALIDATION_ERROR', `Sifre en az ${MIN_PASSWORD_LENGTH} karakter olmalidir`);
    const result = await authService.resetPassword(token, password);
    res.json(result);
  } catch (err) { next(err); }
}

module.exports = { register, login, refreshToken, logout, changePassword, changeEmail, deleteAccount, getProfile, getPlan, forgotPassword, resetPassword };
