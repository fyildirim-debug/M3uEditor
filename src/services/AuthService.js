const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/database');
const jwtConfig = require('../config/jwt');
const logger = require('../config/logger');
const { hashToken } = require('../utils/crypto');
const { createAppError } = require('../utils/AppError');

const SALT_ROUNDS = 12;
const REFRESH_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

class AuthService {
  async register(email, password, metadata = {}) {
    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    let user;
    try {
      [user] = await db('users')
        .insert({ email: normalizedEmail, password_hash: passwordHash })
        .returning(['id', 'email', 'is_admin']);
    } catch (error) {
      if (error.code === '23505') throw createAppError('VALIDATION_ERROR', 'Bu e-posta adresi zaten kayıtlı');
      throw error;
    }

    const session = await this._createSession(user.id, metadata);
    const token = this._generateToken(user.id, session.id);

    const emailService = require('./EmailService');
    emailService.sendWelcome(normalizedEmail).catch((error) => {
      logger.warn({ err: error, userId: user.id }, 'Welcome email could not be sent');
    });

    return { user: this._publicUser(user), token, refreshToken: session.rawToken };
  }

  async login(email, password, metadata = {}) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await db('users').where({ email: normalizedEmail }).first();
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw createAppError('INVALID_CREDENTIALS');
    }

    const session = await this._createSession(user.id, metadata);
    return {
      user: this._publicUser(user),
      token: this._generateToken(user.id, session.id),
      refreshToken: session.rawToken,
    };
  }

  async refreshAccessToken(refreshToken, metadata = {}) {
    if (!refreshToken) throw createAppError('INVALID_CREDENTIALS', 'Oturum yenileme belirteci gerekli');
    const tokenHash = hashToken(refreshToken);

    return db.transaction(async (trx) => {
      let session = await trx('sessions')
        .where({ token_hash: tokenHash, revoked_at: null })
        .forUpdate()
        .first();

      // One-release compatibility for refresh tokens created before the sessions migration.
      if (!session) {
        const legacyUser = await trx('users').where({ refresh_token: refreshToken }).first();
        if (legacyUser && (!legacyUser.refresh_token_expires_at || new Date(legacyUser.refresh_token_expires_at) > new Date())) {
          session = await this._createSession(legacyUser.id, metadata, trx);
          await trx('users').where({ id: legacyUser.id }).update({ refresh_token: null, refresh_token_expires_at: null });
        }
      }

      if (!session || session.revoked_at || new Date(session.expires_at) <= new Date()) {
        throw createAppError('INVALID_CREDENTIALS', 'Geçersiz veya süresi dolmuş oturum');
      }

      const user = await trx('users').where({ id: session.user_id }).first();
      if (!user) throw createAppError('INVALID_CREDENTIALS');

      await trx('sessions').where({ id: session.id }).update({ revoked_at: trx.fn.now(), last_used_at: trx.fn.now() });
      const rotated = await this._createSession(user.id, metadata, trx);

      return {
        user: this._publicUser(user),
        token: this._generateToken(user.id, rotated.id),
        refreshToken: rotated.rawToken,
      };
    });
  }

  async logout({ userId, sessionId, refreshToken } = {}) {
    if (sessionId && userId) {
      await db('sessions').where({ id: sessionId, user_id: userId }).update({ revoked_at: db.fn.now() });
      return;
    }
    if (refreshToken) {
      await db('sessions').where({ token_hash: hashToken(refreshToken) }).update({ revoked_at: db.fn.now() });
    }
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await db('users').where({ id: userId }).first();
    if (!user) throw createAppError('NOT_FOUND');
    if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
      throw createAppError('INVALID_CREDENTIALS', 'Mevcut şifre yanlış');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.transaction(async (trx) => {
      await trx('users').where({ id: userId }).update({ password_hash: passwordHash, updated_at: trx.fn.now() });
      await trx('sessions').where({ user_id: userId, revoked_at: null }).update({ revoked_at: trx.fn.now() });
    });
    return { success: true, reauthenticationRequired: true };
  }

  async changeEmail(userId, password, newEmail) {
    const normalizedEmail = newEmail.trim().toLowerCase();
    const user = await db('users').where({ id: userId }).first();
    if (!user) throw createAppError('NOT_FOUND');
    if (!(await bcrypt.compare(password, user.password_hash))) {
      throw createAppError('INVALID_CREDENTIALS', 'Şifre yanlış');
    }
    const existing = await db('users').where({ email: normalizedEmail }).whereNot({ id: userId }).first();
    if (existing) throw createAppError('VALIDATION_ERROR', 'Bu e-posta zaten kullanılıyor');
    await db('users').where({ id: userId }).update({ email: normalizedEmail, updated_at: db.fn.now() });
    return { email: normalizedEmail };
  }

  async deleteAccount(userId, password) {
    const user = await db('users').where({ id: userId }).first();
    if (!user) throw createAppError('NOT_FOUND');
    if (!(await bcrypt.compare(password, user.password_hash))) {
      throw createAppError('INVALID_CREDENTIALS', 'Şifre yanlış');
    }
    await db('users').where({ id: userId }).del();
    return { success: true };
  }

  async getProfile(userId) {
    const user = await db('users').where({ id: userId }).select('id', 'email', 'is_admin', 'created_at').first();
    if (!user) throw createAppError('NOT_FOUND');
    const stats = await db('playlists').where({ user_id: userId }).count('id as count').first();
    const channelCount = await db('channels')
      .join('playlists', 'channels.playlist_id', 'playlists.id')
      .where('playlists.user_id', userId)
      .count('channels.id as count')
      .first();
    return {
      ...this._publicUser(user),
      created_at: user.created_at,
      playlistCount: Number.parseInt(stats.count, 10),
      channelCount: Number.parseInt(channelCount.count, 10),
    };
  }

  async forgotPassword(email) {
    const user = await db('users').where({ email: email.trim().toLowerCase() }).first();
    if (!user) return { success: true };

    const resetToken = crypto.randomBytes(32).toString('base64url');
    await db('users').where({ id: user.id }).update({
      password_reset_token: hashToken(resetToken),
      password_reset_expires: new Date(Date.now() + 60 * 60 * 1000),
    });
    const emailService = require('./EmailService');
    await emailService.sendPasswordReset(user.email, resetToken);
    return { success: true };
  }

  async resetPassword(token, newPassword) {
    if (!token || !newPassword) throw createAppError('VALIDATION_ERROR', 'Belirteç ve yeni şifre gerekli');

    let user = await db('users').where({ password_reset_token: hashToken(token) }).first();
    if (!user) user = await db('users').where({ password_reset_token: token }).first(); // legacy
    if (!user) throw createAppError('INVALID_CREDENTIALS', 'Geçersiz veya süresi dolmuş bağlantı');
    if (!user.password_reset_expires || new Date(user.password_reset_expires) <= new Date()) {
      throw createAppError('TOKEN_EXPIRED', 'Şifre sıfırlama bağlantısının süresi dolmuş');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.transaction(async (trx) => {
      await trx('users').where({ id: user.id }).update({
        password_hash: passwordHash,
        password_reset_token: null,
        password_reset_expires: null,
        updated_at: trx.fn.now(),
      });
      await trx('sessions').where({ user_id: user.id, revoked_at: null }).update({ revoked_at: trx.fn.now() });
    });
    return { success: true };
  }

  verifyToken(token) {
    try {
      let decoded;
      try {
        decoded = jwt.verify(token, jwtConfig.secret, {
          algorithms: ['HS256'], issuer: jwtConfig.issuer, audience: jwtConfig.audience,
        });
      } catch (strictError) {
        // Access tokens issued before the hardening release remain valid until their short expiry.
        decoded = jwt.verify(token, jwtConfig.secret, { algorithms: ['HS256'] });
        if (decoded.iss || decoded.aud) throw strictError;
      }
      return decoded.sid ? { userId: decoded.userId, sessionId: decoded.sid } : { userId: decoded.userId };
    } catch (error) {
      if (error.name === 'TokenExpiredError') throw createAppError('TOKEN_EXPIRED');
      throw createAppError('INVALID_CREDENTIALS');
    }
  }

  async verifySession(userId, sessionId) {
    if (!sessionId) return;
    const session = await db('sessions')
      .where({ id: sessionId, user_id: userId, revoked_at: null })
      .where('expires_at', '>', db.fn.now())
      .first();
    if (!session) throw createAppError('INVALID_CREDENTIALS', 'Oturum sona ermiş veya iptal edilmiş');
  }

  _generateToken(userId, sessionId) {
    return jwt.sign({ userId, sid: sessionId }, jwtConfig.secret, {
      algorithm: 'HS256',
      expiresIn: jwtConfig.expiresIn,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
    });
  }

  async _createSession(userId, metadata = {}, connection = db) {
    const rawToken = crypto.randomBytes(48).toString('base64url');
    const [session] = await connection('sessions').insert({
      user_id: userId,
      token_hash: hashToken(rawToken),
      expires_at: new Date(Date.now() + REFRESH_LIFETIME_MS),
      user_agent: String(metadata.userAgent || '').slice(0, 500) || null,
      ip_address: String(metadata.ipAddress || '').slice(0, 64) || null,
    }).returning(['id', 'user_id', 'expires_at']);
    return { ...session, rawToken };
  }

  _publicUser(user) {
    return { id: user.id, email: user.email, ...(user.is_admin !== undefined ? { is_admin: Boolean(user.is_admin) } : {}) };
  }
}

module.exports = new AuthService();
