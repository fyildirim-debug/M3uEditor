const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const db = require('../config/database');
const config = require('../config');
const jwtConfig = require('../config/jwt');
const logger = require('../config/logger');
const { hashToken } = require('../utils/crypto');
const { createAppError } = require('../utils/AppError');
const { removeChannelLogos } = require('../utils/logoStorage');

const SALT_ROUNDS = 12;
const REFRESH_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('m3u-editor-dummy-password', SALT_ROUNDS);
const ACCOUNT_LOGO_BATCH_SIZE = 1000;

class AuthService {
  async isRegistrationAllowed(connection = db) {
    if (config.allowRegistration) return true;
    const firstUser = await connection('users').select('id').first();
    return !firstUser;
  }

  async register(email, password, metadata = {}) {
    const normalizedEmail = email.trim().toLowerCase();
    const createRegistration = async (connection) => {
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      let user;
      try {
        [user] = await connection('users')
          .insert({ email: normalizedEmail, password_hash: passwordHash })
          .returning(['id', 'email', 'is_admin']);
      } catch (error) {
        if (error.code === '23505') throw createAppError('VALIDATION_ERROR', 'Bu e-posta adresi zaten kayıtlı');
        throw error;
      }

      const session = await this._createSession(user.id, metadata, connection);
      return { user, session };
    };

    let registration;
    if (config.allowRegistration) {
      registration = await createRegistration(db);
    } else {
      registration = await db.transaction(async (trx) => {
        // Serialize the empty-install exception so only one concurrent request can become the first user.
        await trx.raw('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
        if (!(await this.isRegistrationAllowed(trx))) {
          throw createAppError('FORBIDDEN', 'Yeni kullanıcı kaydı devre dışı');
        }
        return createRegistration(trx);
      });
    }

    const { user, session } = registration;
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
    const passwordMatches = await bcrypt.compare(password, user?.password_hash || DUMMY_PASSWORD_HASH);
    if (!user || !passwordMatches) {
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

    const result = await db.transaction(async (trx) => {
      let session = await trx('sessions')
        .where({ token_hash: tokenHash })
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

      if (session?.revoked_at && session.replaced_by_id) {
        await trx('sessions')
          .where({ family_id: session.family_id, revoked_at: null })
          .update({ revoked_at: trx.fn.now(), revoke_reason: 'reuse' });
        return { reuseDetected: true };
      }

      if (!session || session.revoked_at || new Date(session.expires_at) <= new Date()) {
        throw createAppError('INVALID_CREDENTIALS', 'Geçersiz veya süresi dolmuş oturum');
      }

      const user = await trx('users').where({ id: session.user_id }).first();
      if (!user) throw createAppError('INVALID_CREDENTIALS');

      const rotated = await this._createSession(user.id, metadata, trx, session.family_id || session.id);
      await trx('sessions').where({ id: session.id }).update({
        revoked_at: trx.fn.now(),
        last_used_at: trx.fn.now(),
        replaced_by_id: rotated.id,
        revoke_reason: 'rotated',
      });

      return {
        user: this._publicUser(user),
        token: this._generateToken(user.id, rotated.id),
        refreshToken: rotated.rawToken,
      };
    });

    if (result.reuseDetected) {
      throw createAppError('INVALID_CREDENTIALS', 'Yenileme belirteci yeniden kullanıldı; oturum ailesi iptal edildi');
    }
    return result;
  }

  async logout({ userId, sessionId, refreshToken } = {}) {
    if (sessionId && userId) {
      await db('sessions').where({ id: sessionId, user_id: userId }).update({
        revoked_at: db.fn.now(), revoke_reason: 'logout',
      });
      return;
    }
    if (refreshToken) {
      await db('sessions').where({ token_hash: hashToken(refreshToken) }).update({
        revoked_at: db.fn.now(), revoke_reason: 'logout',
      });
    }
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await db('users').where({ id: userId }).first();
    if (!user) throw createAppError('NOT_FOUND');
    if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
      throw createAppError('INVALID_CREDENTIALS', 'Mevcut şifre yanlış');
    }

    await this._replacePassword(userId, newPassword, 'password_change');
    return { success: true, reauthenticationRequired: true };
  }

  async resetPasswordByEmail(email, newPassword) {
    const normalizedEmail = email.trim().toLowerCase();
    if (typeof newPassword !== 'string' || newPassword.length < 10 || newPassword.length > 128) {
      throw createAppError('VALIDATION_ERROR', 'Şifre 10-128 karakter arasında olmalı');
    }
    const user = await db('users').where({ email: normalizedEmail }).select('id', 'email').first();
    if (!user) throw createAppError('NOT_FOUND', `Kullanıcı bulunamadı: ${normalizedEmail}`);

    await this._replacePassword(user.id, newPassword, 'password_reset', {
      password_reset_token: null,
      password_reset_expires: null,
    });
    return { success: true, email: user.email };
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
    const queuePath = path.join(os.tmpdir(), `m3u-logo-cleanup-${crypto.randomUUID()}.txt`);
    let queueHandle;
    try {
      queueHandle = await fs.promises.open(queuePath, 'wx', 0o600);
      await db.transaction(async (trx) => {
        const lockedUser = await trx('users').where({ id: userId }).forUpdate().first();
        if (!lockedUser) throw createAppError('NOT_FOUND');
        await trx('playlists').where({ user_id: userId }).select('id').forUpdate();

        let lastChannelId = null;
        while (true) {
          const query = trx('channels')
            .join('playlists', 'channels.playlist_id', 'playlists.id')
            .where('playlists.user_id', userId)
            .select('channels.id')
            .orderBy('channels.id', 'asc')
            .limit(ACCOUNT_LOGO_BATCH_SIZE);
          if (lastChannelId !== null) query.andWhere('channels.id', '>', lastChannelId);

          const channels = await query;
          if (channels.length === 0) break;
          await queueHandle.write(`${channels.map((channel) => channel.id).join('\n')}\n`);
          lastChannelId = channels[channels.length - 1].id;
        }
        await queueHandle.close();
        queueHandle = null;
        await trx('users').where({ id: userId }).del();
      });

      try {
        const lines = readline.createInterface({
          input: fs.createReadStream(queuePath, { encoding: 'utf8' }),
          crlfDelay: Infinity,
        });
        let batch = [];
        for await (const channelId of lines) {
          if (!channelId) continue;
          batch.push(channelId);
          if (batch.length === ACCOUNT_LOGO_BATCH_SIZE) {
            await removeChannelLogos(batch);
            batch = [];
          }
        }
        if (batch.length > 0) await removeChannelLogos(batch);
      } catch (error) {
        logger.warn({ err: error, userId }, 'Committed account logo cleanup could not be completed');
      }
      return { success: true };
    } finally {
      if (queueHandle) await queueHandle.close().catch(() => {});
      await fs.promises.unlink(queuePath).catch((error) => {
        if (error.code !== 'ENOENT') logger.warn({ err: error, userId }, 'Account logo cleanup queue could not be removed');
      });
    }
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
    const normalizedEmail = email.trim().toLowerCase();
    const resetToken = crypto.randomBytes(32).toString('base64url');
    const user = await db('users').where({ email: normalizedEmail }).first();
    await db('users').where({ id: user?.id || '00000000-0000-0000-0000-000000000000' }).update({
      password_reset_token: hashToken(resetToken),
      password_reset_expires: new Date(Date.now() + 60 * 60 * 1000),
    });
    if (user) {
      const emailService = require('./EmailService');
      setImmediate(() => {
        try {
          emailService.sendPasswordReset(user.email, resetToken).catch((error) => {
            logger.warn({ err: error, userId: user.id }, 'Password reset email could not be sent');
          });
        } catch (error) {
          logger.warn({ err: error, userId: user.id }, 'Password reset email could not be started');
        }
      });
    }
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

    await this._replacePassword(user.id, newPassword, 'password_reset', {
      password_reset_token: null,
      password_reset_expires: null,
    });
    return { success: true };
  }

  async _replacePassword(userId, newPassword, revokeReason, additionalChanges = {}) {
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.transaction(async (trx) => {
      await trx('users').where({ id: userId }).update({
        ...additionalChanges,
        password_hash: passwordHash,
        updated_at: trx.fn.now(),
      });
      await trx('sessions').where({ user_id: userId, revoked_at: null }).update({
        revoked_at: trx.fn.now(), revoke_reason: revokeReason,
      });
    });
  }

  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, jwtConfig.secret, {
        algorithms: ['HS256'], issuer: jwtConfig.issuer, audience: jwtConfig.audience,
      });
      if (
        typeof decoded !== 'object'
        || typeof decoded.userId !== 'string'
        || decoded.userId.length === 0
        || typeof decoded.sid !== 'string'
        || decoded.sid.length === 0
        || typeof decoded.exp !== 'number'
        || !Number.isFinite(decoded.exp)
      ) {
        throw createAppError('INVALID_CREDENTIALS');
      }
      return { userId: decoded.userId, sessionId: decoded.sid };
    } catch (error) {
      if (error.name === 'TokenExpiredError') throw createAppError('TOKEN_EXPIRED');
      if (error.code === 'INVALID_CREDENTIALS') throw error;
      throw createAppError('INVALID_CREDENTIALS');
    }
  }

  async verifySession(userId, sessionId) {
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

  async _createSession(userId, metadata = {}, connection = db, familyId = null) {
    const rawToken = crypto.randomBytes(48).toString('base64url');
    const sessionId = crypto.randomUUID();
    const [session] = await connection('sessions').insert({
      id: sessionId,
      user_id: userId,
      family_id: familyId || sessionId,
      token_hash: hashToken(rawToken),
      expires_at: new Date(Date.now() + REFRESH_LIFETIME_MS),
      user_agent: String(metadata.userAgent || '').slice(0, 500) || null,
      ip_address: String(metadata.ipAddress || '').slice(0, 64) || null,
    }).returning(['id', 'user_id', 'family_id', 'expires_at']);
    return { ...session, rawToken };
  }

  _publicUser(user) {
    return { id: user.id, email: user.email, ...(user.is_admin !== undefined ? { is_admin: Boolean(user.is_admin) } : {}) };
  }

  /**
   * List active session families (devices) for a user. One entry per family,
   * using the most recent session's device metadata.
   * @param {string} userId
   * @param {string} [currentSessionId] - marks the family containing it as current
   * @returns {Promise<object[]>}
   */
  async listSessions(userId, currentSessionId = null) {
    const sessions = await db('sessions')
      .where({ user_id: userId, revoked_at: null })
      .where('expires_at', '>', db.fn.now())
      .select('id', 'family_id', 'user_agent', 'ip_address', 'last_used_at', 'created_at')
      .orderBy('created_at', 'asc');

    const families = new Map();
    for (const session of sessions) {
      const existing = families.get(session.family_id);
      if (!existing) {
        families.set(session.family_id, {
          familyId: session.family_id,
          userAgent: session.user_agent,
          ipAddress: session.ip_address,
          createdAt: session.created_at,
          lastUsedAt: session.last_used_at || session.created_at,
          current: session.id === currentSessionId,
        });
      } else {
        existing.userAgent = session.user_agent || existing.userAgent;
        existing.ipAddress = session.ip_address || existing.ipAddress;
        if (session.last_used_at && session.last_used_at > existing.lastUsedAt) existing.lastUsedAt = session.last_used_at;
        if (session.id === currentSessionId) existing.current = true;
      }
    }
    return [...families.values()].sort((a, b) => new Date(b.lastUsedAt) - new Date(a.lastUsedAt));
  }

  /**
   * Revoke every active session in a family owned by the user.
   * @param {string} userId
   * @param {string} familyId
   * @returns {Promise<number>} revoked session count
   */
  async revokeSessionFamily(userId, familyId) {
    return db('sessions')
      .where({ user_id: userId, family_id: familyId, revoked_at: null })
      .update({ revoked_at: db.fn.now(), revoke_reason: 'revoked_by_user' });
  }
}

module.exports = new AuthService();
