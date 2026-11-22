const mockDb = jest.fn();
mockDb.fn = { now: jest.fn(() => 'NOW') };
mockDb.raw = jest.fn(() => ({ rows: [], rowCount: 0 }));
mockDb.transaction = jest.fn();
jest.mock('../../../src/config/database', () => mockDb);

const mockBulkDelete = jest.fn();
jest.mock('../../../src/services/ChannelService', () => ({
  bulkDelete: (...args) => mockBulkDelete(...args),
  list: jest.fn(),
  bulkUpdate: jest.fn(),
  bulkMove: jest.fn(),
  bulkRename: jest.fn(),
  previewBulkRename: jest.fn(),
  update: jest.fn(),
  _verifyCategoryForPlaylist: jest.fn(),
}));

const tools = require('../../../src/services/ai/tools');

function builder({ rows = [], first, returning = [] } = {}) {
  const query = {};
  for (const method of ['where', 'andWhere', 'andWhereRaw', 'whereNull', 'whereIn', 'orderBy', 'select', 'limit', 'insert', 'update', 'del', 'join', 'leftJoin', 'groupBy', 'havingRaw', 'count', 'max']) {
    query[method] = jest.fn(() => query);
  }
  query.first = jest.fn().mockResolvedValue(first);
  query.returning = jest.fn().mockResolvedValue(returning);
  query.then = (resolve, reject) => Promise.resolve(rows).then(resolve, reject);
  return query;
}

describe('AI tool registry', () => {
  beforeEach(() => jest.clearAllMocks());

  test('every catalogued tool is a gateway-safe OpenAI function definition', () => {
    const definitions = tools.definitions({ limit: 10_000 });
    expect(definitions.length).toBe(tools.names.length);
    for (const definition of definitions) {
      expect(definition.type).toBe('function');
      expect(typeof definition.function.description).toBe('string');
      const schema = definition.function.parameters;
      expect(schema.type).toBe('object');
      // Bos properties ve additionalProperties, OpenAI semasini Anthropic/Gemini
      // bicimine ceviren gecitlerde 400'e yol aciyor.
      expect(Object.keys(schema.properties || {}).length).toBeGreaterThan(0);
      expect(schema).not.toHaveProperty('additionalProperties');
      for (const spec of Object.values(schema.properties)) {
        expect(typeof spec.type).toBe('string');
      }
    }
  });

  test('caps how many tools go out per request but keeps the rest reachable', () => {
    const definitions = tools.definitions();
    expect(definitions.length).toBeLessThanOrEqual(tools.DEFAULT_TOOL_LIMIT);
    expect(tools.names.length).toBeGreaterThan(definitions.length);
    // Katalogda kalanlar bu uc arac uzerinden erisilebilir olmali.
    const names = definitions.map((definition) => definition.function.name);
    expect(names).toEqual(expect.arrayContaining(['search_capabilities', 'describe_capability', 'invoke_capability']));
  });

  test('the catalogue exposes every tool to the UI', () => {
    expect(tools.catalogue().length).toBe(tools.names.length);
  });

  test('marks data-losing tools so the model can warn the user', () => {
    expect(tools.isDestructive('delete_channels')).toBe(true);
    expect(tools.isDestructive('list_channels')).toBe(false);
    const deleteTool = tools.definitions().find((definition) => definition.function.name === 'delete_playlist');
    expect(deleteTool.function.description).toContain('[YIKICI]');
  });

  test('unknown tool names fail without throwing', async () => {
    await expect(tools.execute('drop_database', {}, { userId: 'user-1' }))
      .resolves.toMatchObject({ ok: false });
  });

  test('destructive tools are blocked when the permission is off', async () => {
    const outcome = await tools.execute('delete_channels', { channelIds: ['a'] }, { userId: 'user-1', allowDestructive: false });
    expect(outcome.ok).toBe(false);
    expect(outcome.code).toBe('FORBIDDEN');
    expect(mockBulkDelete).not.toHaveBeenCalled();
  });

  test('a playlist owned by another user is never touched', async () => {
    mockDb.mockReturnValue(builder({ first: undefined }));
    const outcome = await tools.execute(
      'delete_channels',
      { playlistId: 'foreign', search: 'x' },
      { userId: 'user-1', allowDestructive: true }
    );
    expect(outcome).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(mockBulkDelete).not.toHaveBeenCalled();
  });

  test('filtered deletion resolves ids inside the owned playlist', async () => {
    const playlists = builder({ first: { id: 'p1', user_id: 'user-1' } });
    const channels = builder({ rows: [{ id: 'ch1' }, { id: 'ch2' }] });
    mockDb.mockImplementation((table) => (table === 'playlists' ? playlists : channels));
    mockBulkDelete.mockResolvedValue({ deleted: 2 });

    const outcome = await tools.execute(
      'delete_channels',
      { playlistId: 'p1', filter: 'dead' },
      { userId: 'user-1', allowDestructive: true }
    );

    expect(outcome).toMatchObject({ ok: true, result: { deleted: 2 } });
    expect(mockBulkDelete).toHaveBeenCalledWith('user-1', ['ch1', 'ch2']);
  });

  test('merging fewer than two playlists is rejected', async () => {
    const outcome = await tools.execute('merge_playlists', { sourcePlaylistIds: ['p1'], name: 'Yeni' }, { userId: 'user-1' });
    expect(outcome).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
  });

  test('never lets the model supply an identity of its own', async () => {
    const playlists = builder({ first: { id: 'p1', user_id: 'user-1' } });
    mockDb.mockReturnValue(playlists);

    // Model userId/isAdmin uydurursa bunlar araca hic ulasmamali.
    await tools.execute('get_playlist', { playlistId: 'p1', userId: 'victim', is_admin: true }, { userId: 'user-1' });

    expect(playlists.where).toHaveBeenCalledWith({ id: 'p1', user_id: 'user-1' });
    for (const call of playlists.where.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('victim');
    }
  });

  test('refuses to run without an authenticated session', async () => {
    await expect(tools.execute('list_playlists', {}, {})).resolves.toMatchObject({ ok: false });
    expect(mockDb).not.toHaveBeenCalled();
  });

  test('the catalogue contains no admin-only capability', () => {
    // Asistanin yetkisi kendi kullanicisiyla sinirli: yonetici araci olmamali.
    const adminish = tools.catalogue().filter((tool) => /admin|impersonate|all_users|other_user/i.test(tool.name));
    expect(adminish).toEqual([]);
  });

  test('meta search finds tools that were not sent this turn', async () => {
    const outcome = await tools.execute('search_capabilities', { query: 'logo' }, { userId: 'user-1' });
    expect(outcome.ok).toBe(true);
    expect(outcome.result.tools.length).toBeGreaterThan(0);
    expect(outcome.result.tools.every((tool) => /logo/i.test(`${tool.name} ${tool.description}`))).toBe(true);
  });

  test('invoke_capability honours the destructive permission of the wrapped tool', async () => {
    const outcome = await tools.execute(
      'invoke_capability',
      { name: 'delete_channels', args: { channelIds: ['a'] } },
      { userId: 'user-1', allowDestructive: false }
    );
    expect(outcome).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(mockBulkDelete).not.toHaveBeenCalled();
  });

  test('invoke_capability gates tools that never check the permission themselves', async () => {
    // delete_scheduled_task kendi icinde assertDestructive cagirmiyor; kapinin
    // tek yerde (execute) olmasi bu yolu da kapatmali.
    const outcome = await tools.execute(
      'invoke_capability',
      { name: 'delete_scheduled_task', args: { taskId: 't1' } },
      { userId: 'user-1', allowDestructive: false }
    );
    expect(outcome).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(mockDb).not.toHaveBeenCalled();
  });

  test('invoke_capability validates the wrapped tool arguments', async () => {
    const outcome = await tools.execute(
      'invoke_capability',
      { name: 'delete_channels', args: {} },
      { userId: 'user-1', allowDestructive: true }
    );
    expect(outcome).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    expect(mockBulkDelete).not.toHaveBeenCalled();
  });

  test('invoke_capability cannot wrap a meta tool', async () => {
    const outcome = await tools.execute(
      'invoke_capability',
      { name: 'invoke_capability', args: { name: 'delete_playlist', args: {} } },
      { userId: 'user-1', allowDestructive: true }
    );
    expect(outcome.ok).toBe(false);
  });

  test('approval decisions look through invoke_capability to the real tool', () => {
    expect(tools.isDestructive('invoke_capability', { name: 'delete_playlist', args: {} })).toBe(true);
    expect(tools.needsApproval('invoke_capability', { name: 'delete_playlist', args: {} })).toBe(true);
    expect(tools.needsApproval('invoke_capability', { name: 'list_playlists', args: {} })).toBe(false);
    expect(tools.isReadOnly('invoke_capability', { name: 'delete_playlist' })).toBe(false);
    expect(tools.resolveCall('invoke_capability', { name: 'list_playlists', args: { a: 1 } }))
      .toEqual({ name: 'list_playlists', args: { a: 1 }, wrapped: true });
  });

  test('lasting outward-facing changes ask for approval even when not destructive', () => {
    for (const name of ['create_scheduled_task', 'update_scheduled_task', 'run_scheduled_task_now', 'share_playlist', 'enable_xtream_output', 'set_playlist_xtream_credentials']) {
      expect(tools.needsApproval(name, {})).toBe(true);
    }
    expect(tools.needsApproval('update_channel', { channelId: 'c', name: 'Yeni' })).toBe(false);
    expect(tools.needsApproval('update_channel', { channelId: 'c', streamUrl: 'http://x' })).toBe(true);
  });

  test('a scheduled task cannot schedule, change or undo tasks', async () => {
    const ctx = { userId: 'user-1', allowDestructive: true, isTaskRun: true };
    for (const [name, args] of [
      ['create_scheduled_task', { name: 'x', prompt: 'y', intervalMinutes: 60 }],
      ['update_scheduled_task', { taskId: 't1', allowDestructive: true }],
      ['delete_scheduled_task', { taskId: 't1' }],
      ['undo_task_run', { runId: 'r1' }],
    ]) {
      const outcome = await tools.execute(name, args, ctx);
      expect(outcome).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    }
    expect(mockDb).not.toHaveBeenCalled();
  });

  test('a task bound to a playlist cannot touch another playlist', async () => {
    const outcome = await tools.execute(
      'list_channels',
      { playlistId: 'other-playlist' },
      { userId: 'user-1', isTaskRun: true, taskPlaylistId: 'bound-playlist' }
    );
    expect(outcome).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(mockDb).not.toHaveBeenCalled();
  });

  test('a destructive task cannot be created while destructive actions are off', async () => {
    const outcome = await tools.execute(
      'create_scheduled_task',
      { name: 'temizle', prompt: 'olu kanallari sil', intervalMinutes: 60, allowDestructive: true },
      { userId: 'user-1', allowDestructive: false }
    );
    expect(outcome).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  });

  test('an EPG mapping set by the assistant is locked against auto-matching', async () => {
    let patch;
    mockDb.mockImplementation((table) => {
      if (table === 'channels') {
        const query = builder({ first: { id: 'c1', playlist_id: 'p1' }, returning: [{ id: 'c1', name: 'TRT 1', epg_channel_id: 'trt1.tr' }] });
        query.update = jest.fn((value) => { patch = value; return query; });
        return query;
      }
      return builder({ first: { id: 'x', source_id: 's1', user_id: 'user-1' } });
    });

    const outcome = await tools.execute('assign_epg_to_channel', { channelId: 'c1', epgChannelId: 'trt1.tr' }, { userId: 'user-1' });

    expect(outcome.ok).toBe(true);
    expect(patch).toMatchObject({ epg_channel_id: 'trt1.tr', epg_locked: true });
  });

  test('custom sorting refuses ids from another playlist', async () => {
    const playlists = builder({ first: { id: 'p1', user_id: 'user-1' } });
    const channels = builder({ first: { count: '1' } });
    mockDb.mockImplementation((table) => (table === 'playlists' ? playlists : channels));

    const outcome = await tools.execute(
      'sort_channels',
      { playlistId: 'p1', by: 'custom', order: ['ch1', 'foreign'] },
      { userId: 'user-1' }
    );
    expect(outcome).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    expect(mockDb.raw).not.toHaveBeenCalled();
  });

  // Katalog 159 arac, tek istekte gonderilebilen ~117. Sabit sirada
  // gonderildiginde son modullerin araclari hicbir zaman dogrudan gorunmuyordu.
  test('relevance ranking surfaces tools that a fixed order would never send', () => {
    const fixedOrder = tools.definitions().map((definition) => definition.function.name);
    const ranked = tools.definitions({ hints: 'paylaşım linki oluştur ve xtream çıkışını aç' })
      .map((definition) => definition.function.name);

    expect(fixedOrder).not.toContain('share_playlist');
    expect(fixedOrder).not.toContain('enable_xtream_output');
    expect(ranked).toContain('share_playlist');
    expect(ranked).toContain('enable_xtream_output');
    expect(ranked.length).toBeLessThanOrEqual(tools.DEFAULT_TOOL_LIMIT);
  });

  test('ranking matches Turkish suffixed words and keeps meta tools', () => {
    const names = tools.definitions({ hints: 'yedekleri listele' }).map((definition) => definition.function.name);
    // "yedekleri" -> "yedek" govdesi; create_backup/list_backups yakalanmali.
    expect(names.slice(0, 20)).toEqual(expect.arrayContaining(['list_backups']));
    expect(names).toEqual(expect.arrayContaining(['search_capabilities', 'invoke_capability']));
  });

  test('ranking is deterministic and falls back to module order without hints', () => {
    expect(tools.definitions()).toEqual(tools.definitions({ hints: '' }));
    expect(tools.definitions({ hints: 'logo' })).toEqual(tools.definitions({ hints: 'logo' }));
  });

  test('schema violations are reported to the model with the schema attached', async () => {
    const outcome = await tools.execute('rename_playlist', { playlistId: 'p1' }, { userId: 'user-1' });
    expect(outcome.ok).toBe(false);
    expect(outcome.code).toBe('VALIDATION_ERROR');
    expect(outcome.error).toContain('name');
    expect(outcome.schema).toBeDefined();
    expect(mockDb).not.toHaveBeenCalled();
  });

  test('wrong argument types are rejected before the tool runs', async () => {
    const outcome = await tools.execute('list_channels', { playlistId: 'p1', limit: 'hepsi' }, { userId: 'user-1' });
    expect(outcome).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    expect(outcome.error).toContain('limit');
    expect(mockDb).not.toHaveBeenCalled();
  });

  test('read-only tools are separable from writing ones for parallel execution', () => {
    expect(tools.isReadOnly('list_channels')).toBe(true);
    expect(tools.isReadOnly('get_playlist')).toBe(true);
    expect(tools.isReadOnly('update_channel')).toBe(false);
    expect(tools.isReadOnly('delete_channels')).toBe(false);
    expect(tools.isReadOnly('sync_playlist')).toBe(false);
  });
});
