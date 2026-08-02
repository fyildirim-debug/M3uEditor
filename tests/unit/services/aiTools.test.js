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
});
