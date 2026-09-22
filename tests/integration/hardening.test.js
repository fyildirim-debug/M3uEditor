const enabled = process.env.RUN_DB_TESTS === '1';
const suite = enabled ? describe : describe.skip;

suite('PostgreSQL security and restore regression', () => {
  let db;
  let config;
  let backups;
  let auth;
  let user;
  let playlist;
  let root;
  let previousDir;
  const fs = require('fs/promises');
  const path = require('path');
  const os = require('os');
  const crypto = require('crypto');

  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'test') throw new Error('Requires NODE_ENV=test');
    db = require('../../src/config/database');
    config = require('../../src/config');
    backups = require('../../src/services/BackupService');
    auth = require('../../src/services/AuthService');
    previousDir = config.uploadDir;
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'm3u-integration-'));
    config.uploadDir = path.join(root, 'logos');
    [user] = await db('users').insert({ email: `${crypto.randomUUID()}@example.test`, password_hash: 'fixture' }).returning('*');
    [playlist] = await db('playlists').insert({ user_id: user.id, name: 'Restore fixture' }).returning('*');
  });

  afterAll(async () => {
    if (user) await db('users').where({ id: user.id }).del();
    if (db) await db.destroy();
    if (config) config.uploadDir = previousDir;
    if (root) await fs.rm(root, { recursive: true, force: true });
  });

  test('restore preserves hidden categories, original URLs and stable IDs', async () => {
    const [category] = await db('categories').insert({ playlist_id: playlist.id, name: 'Hidden', is_hidden: true }).returning('*');
    const [channel] = await db('channels').insert({ playlist_id: playlist.id, category_id: category.id, name: 'Live', stream_url: 'https://example.test/live?signature=fixture' }).returning('*');
    const backup = await backups.createBackup(user.id, playlist.id);
    expect(backups.resolveBackupPath(backup.filename).startsWith(config.uploadDir + path.sep)).toBe(false);
    await db('categories').where({ id: category.id }).update({ is_hidden: false });
    await db('channels').where({ id: channel.id }).update({ stream_url: 'https://example.test/changed' });
    await backups.restoreBackup(user.id, backup.id, playlist.id);
    expect(await db('categories').where({ id: category.id }).first()).toMatchObject({ is_hidden: true, xtream_id: category.xtream_id });
    expect(await db('channels').where({ id: channel.id }).first()).toMatchObject({ stream_url: channel.stream_url, xtream_id: channel.xtream_id });
    await expect(backups.getBackupFile(crypto.randomUUID(), backup.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('only one concurrent reset consumes a token', async () => {
    const token = crypto.randomUUID();
    const { hashToken } = require('../../src/utils/crypto');
    await db('users').where({ id: user.id }).update({ password_reset_token: hashToken(token), password_reset_expires: new Date(Date.now() + 60000) });
    const results = await Promise.allSettled([
      auth.resetPassword(token, 'first-fixture-password'),
      auth.resetPassword(token, 'second-fixture-password'),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
  });
});
