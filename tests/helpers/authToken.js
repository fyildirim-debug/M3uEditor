const jwt = require('jsonwebtoken');
const jwtConfig = require('../../src/config/jwt');
const authService = require('../../src/services/AuthService');

const TEST_SESSION_ID = '11111111-1111-4111-8111-111111111111';

/**
 * Erişim token'ları artık issuer, audience, exp ve oturum kimliği (`sid`)
 * zorunlu kılıyor; ayrıca her istekte veritabanındaki oturum doğrulanıyor.
 * Controller testleri gerçek bir oturum tablosu kullanmadığı için bu yardımcı
 * hem geçerli bir token üretir hem de oturum doğrulamasını taklit eder.
 *
 * @param {string} userId
 * @param {{ sessionId?: string }} [options]
 * @returns {string} İmzalanmış erişim token'ı
 */
function signTestToken(userId, { sessionId = TEST_SESSION_ID } = {}) {
  return jwt.sign({ userId, sid: sessionId }, jwtConfig.secret, {
    algorithm: 'HS256',
    expiresIn: '1h',
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience,
  });
}

/**
 * Oturum tablosu sorgusunu geçerli sayar. Her testin `beforeEach`inde,
 * `jest.clearAllMocks()` çağrısından SONRA çağrılmalıdır.
 */
function stubActiveSession() {
  return jest.spyOn(authService, 'verifySession').mockResolvedValue(undefined);
}

module.exports = { signTestToken, stubActiveSession, TEST_SESSION_ID };
