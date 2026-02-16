const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const jwtConfig = require('../config/jwt');
const { createAppError } = require('../utils/AppError');

const SALT_ROUNDS = 10;

class AuthService {
  /**
   * Register a new user.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ user: { id: string, email: string }, token: string }>}
   */
  async register(email, password) {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const [user] = await db('users')
      .insert({ email, password_hash: passwordHash })
      .returning(['id', 'email']);

    const token = this._generateToken(user.id);

    return { user: { id: user.id, email: user.email }, token };
  }

  /**
   * Login with email and password.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ user: { id: string, email: string }, token: string }>}
   */
  async login(email, password) {
    const user = await db('users').where({ email }).first();

    if (!user) {
      throw createAppError('INVALID_CREDENTIALS');
    }

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      throw createAppError('INVALID_CREDENTIALS');
    }

    const token = this._generateToken(user.id);

    return { user: { id: user.id, email: user.email }, token };
  }

  /**
   * Verify a JWT token and return the userId.
   * @param {string} token
   * @returns {{ userId: string }}
   */
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, jwtConfig.secret);
      return { userId: decoded.userId };
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw createAppError('TOKEN_EXPIRED');
      }
      throw createAppError('INVALID_CREDENTIALS');
    }
  }

  /**
   * Generate a JWT token for a given userId.
   * @param {string} userId
   * @returns {string}
   */
  _generateToken(userId) {
    return jwt.sign({ userId }, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn });
  }
}

module.exports = new AuthService();
