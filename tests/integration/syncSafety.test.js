const enabled = process.env.RUN_DB_TESTS === '1';
const suite = enabled ? describe : describe.skip;

// Gercek PostgreSQL'e karsi: upsert'in kullanici duzenlemelerini korumasi,
// ayni adresli kayitlar, EPG kilidi ve zamanlayici vade sorgulari.
suite('PostgreSQL sync safety regression', () => {
  let db;
  let user;
  let playlist;
  let ImportService;
  let EPGService;
  let categoryService;
  let scheduler;
  const crypto = require('crypto');

  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'test') throw new Error('Requires NODE_ENV=test');
    db = require('../../src/config/database');
    ImportService = require('../../src/services/ImportService');
    EPGService = require('../../src/services/EPGService');
    categoryService = require('../../src/services/CategoryService');
    scheduler = require('../../src/services/SchedulerService');
    [user] = await db('users').insert({ email: `${crypto.randomUUID()}@example.test`, password_hash: 'fixture' }).returning('*');
  });

  beforeEach(async () => {
    [playlist] = await db('playlists').insert({ user_id: user.id, name: `Sync fixture ${crypto.randomUUID()}` }).returning('*');
  });

  afterAll(async () => {
    if (user) await db('users').where({ id: user.id }).del();
    if (db) await db.destroy();
  });

  function record(sourceId, overrides = {}) {
    return {
      id: crypto.randomUUID(),
      playlist_id: playlist.id,
      source_id: String(sourceId),
      stream_type: 'live',
      name: `Provider ${sourceId}`,
      original_name: `Provider ${sourceId}`,
      logo_url: null,
      original_logo_url: null,
      stream_url: `https://provider.test/live/${sourceId}.ts`,
      epg_channel_id: null,
      category_id: null,
      original_category_id: null,
      sort_order: 0,
      extras: JSON.stringify({ stream_id: sourceId }),
      ...overrides,
    };
  }

  test('sync keeps user order and category moves but follows provider moves of untouched channels', async () => {
    const service = new ImportService();
    const [catA, catB, catUser] = await db('categories').insert([
      { playlist_id: playlist.id, name: 'A', sort_order: 0 },
      { playlist_id: playlist.id, name: 'B', sort_order: 1 },
      { playlist_id: playlist.id, name: 'Mine', sort_order: 2 },
    ]).returning('*');
    await service._bulkUpsertChannels(playlist.id, [
      record(1, { category_id: catA.id, original_category_id: catA.id }),
      record(2, { category_id: catA.id, original_category_id: catA.id }),
      record(3, { category_id: catA.id, original_category_id: catA.id }),
    ], null, db);

    // Kullanici 3'u en basa alir ve 2'yi kendi kategorisine tasir
    await db('channels').where({ playlist_id: playlist.id, source_id: '3' }).update({ sort_order: -10 });
    await db('channels').where({ playlist_id: playlist.id, source_id: '2' }).update({ category_id: catUser.id });

    // Saglayici hepsini B'ye tasir ve yeni bir kanal ekler
    const existingKeys = new Set(['live:1', 'live:2', 'live:3']);
    await service._bulkUpsertChannels(playlist.id, [
      record(1, { category_id: catB.id, original_category_id: catB.id }),
      record(2, { category_id: catB.id, original_category_id: catB.id }),
      record(3, { category_id: catB.id, original_category_id: catB.id }),
      record(4, { category_id: catB.id, original_category_id: catB.id }),
    ], null, db, undefined, { existingKeys });

    const rows = Object.fromEntries((await db('channels').where({ playlist_id: playlist.id }))
      .map((row) => [row.source_id, row]));
    expect(rows['3'].sort_order).toBe(-10);
    expect(rows['1'].sort_order).toBe(0);
    expect(rows['4'].sort_order).toBe(2); // mevcut en buyuk (1) + 1
    expect(rows['1'].category_id).toBe(catB.id); // dokunulmamis: saglayiciyi izler
    expect(rows['2'].category_id).toBe(catUser.id); // kullanici tasimasi korunur
    expect(rows['2'].original_category_id).toBe(catB.id);
  });

  test('duplicate stream URLs are skipped instead of aborting the sync', async () => {
    const service = new ImportService();
    await db('channels').insert({
      playlist_id: playlist.id, name: 'Manual', stream_url: 'https://provider.test/live/shared.ts', sort_order: 0,
    });

    const result = await service._bulkUpsertChannels(playlist.id, [
      record(10),
      record(11, { stream_url: record(10).stream_url }),
      record(12, { stream_url: 'https://provider.test/live/shared.ts' }),
    ], null, db);

    expect(result.skippedDuplicates).toBe(2);
    const sources = (await db('channels').where({ playlist_id: playlist.id }).whereNotNull('source_id').pluck('source_id')).sort();
    expect(sources).toEqual(['10']);
  });

  test('auto-match fills only empty, unlocked mappings and ignores stop-word-only overlaps', async () => {
    const epg = new EPGService();
    const [source] = await db('epg_sources').insert({ user_id: user.id, url: 'enc:v1:fixture', status: 'active' }).returning('*');
    await db('epg_channels').insert([
      { source_id: source.id, channel_id: 'news.one', display_name: 'News One' },
      { source_id: source.id, channel_id: 'sports.hd', display_name: 'Sports HD' },
      { source_id: source.id, channel_id: 'cinema.tr', display_name: 'TR Cinema' },
    ]);
    const [empty, manual, provider, stopOnly] = await db('channels').insert([
      { playlist_id: playlist.id, name: 'News One', stream_url: 'https://x.test/1', sort_order: 0 },
      { playlist_id: playlist.id, name: 'News One', stream_url: 'https://x.test/2', sort_order: 1, epg_channel_id: 'user.choice', epg_locked: true },
      { playlist_id: playlist.id, name: 'News One', stream_url: 'https://x.test/3', sort_order: 2, epg_channel_id: 'provider.id' },
      { playlist_id: playlist.id, name: 'Music HD', stream_url: 'https://x.test/4', sort_order: 3 },
    ]).returning('*');

    const result = await epg.autoMatch(user.id, playlist.id);
    expect(result.matches.map((match) => match.channelId)).toEqual([empty.id]);
    const byId = Object.fromEntries((await db('channels').where({ playlist_id: playlist.id })).map((row) => [row.id, row]));
    expect(byId[empty.id].epg_channel_id).toBe('news.one');
    expect(byId[manual.id].epg_channel_id).toBe('user.choice');
    expect(byId[provider.id].epg_channel_id).toBe('provider.id');
    expect(byId[stopOnly.id].epg_channel_id).toBeNull(); // yalnizca "hd" ortak

    const overwrite = await epg.autoMatch(user.id, playlist.id, null, { overwrite: true });
    expect(overwrite.matches.map((match) => match.channelId).sort()).toEqual([empty.id, provider.id].sort());
    expect((await db('channels').where({ id: manual.id }).first()).epg_channel_id).toBe('user.choice');
    await db('epg_sources').where({ id: source.id }).del();
  });

  test('category delete recompacts the remaining order in one statement', async () => {
    const categories = await db('categories').insert([
      { playlist_id: playlist.id, name: 'One', sort_order: 0 },
      { playlist_id: playlist.id, name: 'Two', sort_order: 5 },
      { playlist_id: playlist.id, name: 'Three', sort_order: 9 },
    ]).returning('*');
    await categoryService.delete(user.id, categories[0].id);
    const remaining = await db('categories').where({ playlist_id: playlist.id }).orderBy('sort_order');
    expect(remaining.map((row) => [row.name, row.sort_order])).toEqual([['Two', 0], ['Three', 1]]);
  });

  test('account deletion removes the playlist backup directories from disk', async () => {
    const fs = require('fs/promises');
    const path = require('path');
    const os = require('os');
    const config = require('../../src/config');
    const backups = require('../../src/services/BackupService');
    const auth = require('../../src/services/AuthService');
    const previousDir = config.uploadDir;
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'm3u-purge-'));
    config.uploadDir = path.join(root, 'logos');
    try {
      const [doomed] = await db('users').insert({ email: `${crypto.randomUUID()}@example.test`, password_hash: 'fixture' }).returning('*');
      const [owned] = await db('playlists').insert({ user_id: doomed.id, name: 'Doomed' }).returning('*');
      await backups.createBackup(doomed.id, owned.id, 'manual');
      await expect(fs.access(backups.playlistDir(owned.id))).resolves.toBeUndefined();

      await auth.purgeUser(doomed.id);

      await expect(fs.access(backups.playlistDir(owned.id))).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await db('users').where({ id: doomed.id }).first()).toBeUndefined();
    } finally {
      config.uploadDir = previousDir;
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  test('scheduler due queries skip playlists that are backing off and clamp tiny intervals', async () => {
    const past = new Date(Date.now() - 2 * 60 * 60_000);
    await db('playlists').where({ id: playlist.id }).update({
      xtream_server_url: 'https://provider.test', sync_interval_minutes: 1, last_synced_at: new Date(Date.now() - 5 * 60_000),
    });
    expect((await scheduler._duePlaylists(new Date())).map((row) => row.id)).not.toContain(playlist.id);

    await db('playlists').where({ id: playlist.id }).update({
      last_synced_at: past, sync_next_attempt_at: new Date(Date.now() + 60 * 60_000), sync_failure_count: 2,
    });
    expect((await scheduler._duePlaylists(new Date())).map((row) => row.id)).not.toContain(playlist.id);

    await db('playlists').where({ id: playlist.id }).update({ sync_next_attempt_at: new Date(Date.now() - 1000) });
    const due = await scheduler._duePlaylists(new Date());
    expect(due.find((row) => row.id === playlist.id)).toMatchObject({ sync_failure_count: 2 });
  });
});
