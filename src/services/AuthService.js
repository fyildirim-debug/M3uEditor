const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/database');
const jwtConfig = require('../config/jwt');
const { createAppError } = require('../utils/AppError');

const SALT_ROUNDS = 10;

class AuthService {
  async register(email, password) {
    const existing = await db('users').where({ email }).first();
    if (existing) {
      throw createAppError('VALIDATION_ERROR', 'Bu e-posta adresi zaten kayitli');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const [user] = await db('users')
      .insert({ email, password_hash: passwordHash })
      .returning(['id', 'email']);

    const token = this._generateToken(user.id);
    const refreshToken = await this._generateRefreshToken(user.id);

    // Send welcome email (fire-and-forget)
    const emailService = require('./EmailService');
    emailService.sendWelcome(email).catch(() => {});

    return { user: { id: user.id, email: user.email }, token, refreshToken };
  }

  async login(email, password) {
    const user = await db('users').where({ email }).first();
    if (!user) throw createAppError('INVALID_CREDENTIALS');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw createAppError('INVALID_CREDENTIALS');

    const token = this._generateToken(user.id);
    const refreshToken = await this._generateRefreshToken(user.id);

    return { user: { id: user.id, email: user.email }, token, refreshToken };
  }

  async refreshAccessToken(refreshToken) {
    if (!refreshToken) throw createAppError('INVALID_CREDENTIALS', 'Refresh token gereklidir');

    const user = await db('users').where({ refresh_token: refreshToken }).first();
    if (!user) throw createAppError('INVALID_CREDENTIALS', 'Gecersiz refresh token');

    if (user.refresh_token_expires_at && new Date(user.refresh_token_expires_at) < new Date()) {
      throw createAppError('TOKEN_EXPIRED', 'Refresh token suresi dolmus');
    }

    const token = this._generateToken(user.id);
    const newRefreshToken = await this._generateRefreshToken(user.id);

    return { token, refreshToken: newRefreshToken };
  }

  async logout(userId) {
    await db('users').where({ id: userId }).update({
      refresh_token: null,
      refresh_token_expires_at: null,
    });
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await db('users').where({ id: userId }).first();
    if (!user) throw createAppError('NOT_FOUND');

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) throw createAppError('INVALID_CREDENTIALS', 'Mevcut sifre yanlis');

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db('users').where({ id: userId }).update({ password_hash: passwordHash });

    return { success: true };
  }

  async changeEmail(userId, password, newEmail) {
    const user = await db('users').where({ id: userId }).first();
    if (!user) throw createAppError('NOT_FOUND');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw createAppError('INVALID_CREDENTIALS', 'Sifre yanlis');

    const existing = await db('users').where({ email: newEmail }).first();
    if (existing) throw createAppError('VALIDATION_ERROR', 'Bu e-posta zaten kullaniliyor');

    await db('users').where({ id: userId }).update({ email: newEmail });
    return { email: newEmail };
  }

  async deleteAccount(userId, password) {
    const user = await db('users').where({ id: userId }).first();
    if (!user) throw createAppError('NOT_FOUND');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw createAppError('INVALID_CREDENTIALS', 'Sifre yanlis');

    await db('users').where({ id: userId }).del();
    return { success: true };
  }

  async getProfile(userId) {
    const user = await db('users').where({ id: userId }).select('id', 'email', 'created_at').first();
    if (!user) throw createAppError('NOT_FOUND');

    const stats = await db('playlists').where({ user_id: userId }).count('id as count').first();
    const channelCount = await db('channels')
      .join('playlists', 'channels.playlist_id', 'playlists.id')
      .where('playlists.user_id', userId)
      .count('channels.id as count')
      .first();

    return {
      ...user,
      playlistCount: parseInt(stats.count, 10),
      channelCount: parseInt(channelCount.count, 10),
    };
  }

  async forgotPassword(email) {
    const user = await db('users').where({ email }).first();
    if (!user) {
      // Don't reveal whether email exists — always return success
      return { success: true };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date();
    expires.setHours(expires.getHours() + 1); // 1 hour expiry

    await db('users').where({ id: user.id }).update({
      password_reset_token: resetToken,
      password_reset_expires: expires,
    });

    const emailService = require('./EmailService');
    await emailService.sendPasswordReset(email, resetToken);

    return { success: true };
  }

  async resetPassword(token, newPassword) {
    if (!token || !newPassword) {
      throw createAppError('VALIDATION_ERROR', 'Token ve yeni sifre gereklidir');
    }

    const user = await db('users').where({ password_reset_token: token }).first();
    if (!user) {
      throw createAppError('INVALID_CREDENTIALS', 'Gecersiz veya suresi dolmus token');
    }

    if (user.password_reset_expires && new Date(user.password_reset_expires) < new Date()) {
      throw createAppError('TOKEN_EXPIRED', 'Sifre sifirlama linkinin suresi dolmus');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db('users').where({ id: user.id }).update({
      password_hash: passwordHash,
      password_reset_token: null,
      password_reset_expires: null,
    });

    return { success: true };
  }

  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, jwtConfig.secret);
      return { userId: decoded.userId };
    } catch (err) {
      if (err.name === 'TokenExpiredError') throw createAppError('TOKEN_EXPIRED');
      throw createAppError('INVALID_CREDENTIALS');
    }
  }

  _generateToken(userId) {
    return jwt.sign({ userId }, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn });
  }

  async _generateRefreshToken(userId) {
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await db('users').where({ id: userId }).update({
      refresh_token: refreshToken,
      refresh_token_expires_at: expiresAt,
    });

    return refreshToken;
  }
}

module.exports = new AuthService();
