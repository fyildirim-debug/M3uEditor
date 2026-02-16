/**
 * JWT configuration.
 */
module.exports = {
  secret: process.env.JWT_SECRET || 'dev-secret-do-not-use-in-production',
  expiresIn: '24h',
};
