const crypto = require('crypto');
const config = require('../config');

const PREFIX = 'enc:v1:';
const KEY = crypto.createHash('sha256').update(config.credentialEncryptionKey).digest();

function encrypt(value) {
  if (value === null || value === undefined || value === '') return value;
  if (String(value).startsWith(PREFIX)) return value;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

function decrypt(value) {
  if (value === null || value === undefined || value === '') return value;
  if (!String(value).startsWith(PREFIX)) return String(value); // legacy plaintext, migrated on next write

  const [ivPart, tagPart, dataPart] = String(value).slice(PREFIX.length).split('.');
  if (!ivPart || !tagPart || !dataPart) throw new Error('Encrypted credential is malformed');

  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function hashToken(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

module.exports = { encrypt, decrypt, hashToken };
