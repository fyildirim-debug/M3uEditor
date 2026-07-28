const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '../..');

function loadProductionConfig(jwtSecret, encryptionKey) {
  return spawnSync(process.execPath, ['-e', "require('./src/config')"], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      JWT_SECRET: jwtSecret,
      CREDENTIAL_ENCRYPTION_KEY: encryptionKey,
    },
  });
}

describe('Production secret validation', () => {
  test.each([
    ['replace-with-a-long-random-secret', 'replace-with-another-long-random-secret'],
    ['BURAYI_DEGISTIR_JWT_SECRET_GECERSIZ', 'BURAYI_DEGISTIR_ENCRYPTION_KEY_GECERSIZ'],
  ])('rejects documented placeholder secrets', (jwtSecret, encryptionKey) => {
    const result = loadProductionConfig(jwtSecret, encryptionKey);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('openssl rand -hex 32');
  });

  test('rejects identical JWT and credential encryption secrets', () => {
    const secret = 'f39d8a074cf44777891cf847ebd34fd041d599577969cb10f0a0469bc5903701';
    const result = loadProductionConfig(secret, secret);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('farklı olmalı');
  });

  test('rejects repeated and dictionary-like low entropy secrets', () => {
    const repeated = loadProductionConfig('a'.repeat(64), 'b'.repeat(64));
    const dictionary = loadProductionConfig('passwordsecretpasswordsecretpasswordsecret', 'c2d9a785339040bbb80bf0b073f17a48');

    expect(repeated.status).not.toBe(0);
    expect(dictionary.status).not.toBe(0);
  });

  test('accepts independent high entropy secrets', () => {
    const result = loadProductionConfig(
      'f39d8a074cf44777891cf847ebd34fd041d599577969cb10f0a0469bc5903701',
      'b7a15dc139d24be8ab8ab9fe3ad588e141f55184b06246049d5289f02b8739ee'
    );

    expect(result.status).toBe(0);
  });
});
