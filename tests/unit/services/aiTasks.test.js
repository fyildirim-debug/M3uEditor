/**
 * Zamanlanmis asistan gorevleri: dogrulama, sahiplenme ve calistirma.
 */

const mockDb = jest.fn();
mockDb.fn = { now: jest.fn(() => 'NOW') };
jest.mock('../../../src/config/database', () => mockDb);

const mockChat = jest.fn();
jest.mock('../../../src/services/AIService', () => ({ chat: (...args) => mockChat(...args) }));

const taskService = require('../../../src/services/ai/tasks');

function builder({ rows = [], first, returning = [], updated = 0 } = {}) {
  const query = {};
  for (const method of ['where', 'andWhere', 'orWhere', 'orderBy', 'select', 'limit', 'insert', 'join', 'leftJoin', 'count', 'whereNull', 'whereRaw', 'andWhereRaw', 'orWhereRaw', 'whereNotNull']) {
    query[method] = jest.fn(() => query);
  }
  query.first = jest.fn().mockResolvedValue(first);
  query.returning = jest.fn().mockResolvedValue(returning);
  query.update = jest.fn(() => {
    const chain = { returning: jest.fn().mockResolvedValue(returning) };
    chain.then = (resolve, reject) => Promise.resolve(updated).then(resolve, reject);
    return chain;
  });
  query.del = jest.fn(() => ({ then: (resolve, reject) => Promise.resolve(updated).then(resolve, reject) }));
  query.then = (resolve, reject) => Promise.resolve(rows).then(resolve, reject);
  return query;
}

function mockTables(tables = {}) {
  mockDb.mockImplementation((table) => (tables[table] || (() => builder()))());
}

const TASK_ROW = {
  id: 'task-1',
  user_id: 'user-1',
  playlist_id: 'pl-1',
  name: 'Gece temizligi',
  prompt: 'Ölü kanalları test et ve sil',
  interval_minutes: 1440,
  enabled: true,
  allow_destructive: true,
  run_count: 3,
};

describe('AI scheduled task validation', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rejects an interval below the configured minimum', async () => {
    mockTables({ ai_tasks: () => builder({ first: { count: '0' } }) });
    await expect(taskService.create('user-1', { name: 'a', prompt: 'b', intervalMinutes: 5 }))
      .rejects.toThrow(/en az 15 dakika/i);
  });

  test('rejects an interval longer than 30 days', async () => {
    mockTables({ ai_tasks: () => builder({ first: { count: '0' } }) });
    await expect(taskService.create('user-1', { name: 'a', prompt: 'b', intervalMinutes: 50_000 }))
      .rejects.toThrow(/en fazla 30 gün/i);
  });

  test('requires a name and a prompt', async () => {
    mockTables({ ai_tasks: () => builder({ first: { count: '0' } }) });
    await expect(taskService.create('user-1', { name: '  ', prompt: 'b', intervalMinutes: 60 })).rejects.toThrow(/adı gerekli/i);
    await expect(taskService.create('user-1', { name: 'a', prompt: '', intervalMinutes: 60 })).rejects.toThrow(/yönergesi gerekli/i);
  });

  test('enforces the per-user task ceiling', async () => {
    mockTables({ ai_tasks: () => builder({ first: { count: '25' } }) });
    await expect(taskService.create('user-1', { name: 'a', prompt: 'b', intervalMinutes: 60 }))
      .rejects.toThrow(/en fazla 25/i);
  });

  test('defaults destructive permission to off', async () => {
    let inserted;
    mockTables({
      ai_tasks: () => {
        const query = builder({ first: { count: '0' }, returning: [{ ...TASK_ROW, allow_destructive: false }] });
        query.insert = jest.fn((row) => { inserted = row; return { returning: jest.fn().mockResolvedValue([{ ...TASK_ROW, ...row }]) }; });
        return query;
      },
      playlists: () => builder({ first: { id: 'pl-1' } }),
    });

    await taskService.create('user-1', { name: 'a', prompt: 'b', intervalMinutes: 60 });
    expect(inserted.allow_destructive).toBe(false);
  });

  test('rejects a playlist that does not belong to the user', async () => {
    mockTables({
      ai_tasks: () => builder({ first: { count: '0' } }),
      playlists: () => builder({ first: undefined }),
    });
    await expect(taskService.create('user-1', { name: 'a', prompt: 'b', intervalMinutes: 60, playlistId: 'other' }))
      .rejects.toThrow(/bulunamadı/i);
  });
});

describe('AI scheduled task execution', () => {
  beforeEach(() => jest.clearAllMocks());

  test('runs unattended: no approval prompt, marked as a task run', async () => {
    mockTables({ ai_tasks: () => builder({ first: TASK_ROW }) });
    mockChat.mockResolvedValue({ reply: '12 kanal silindi', steps: [{ tool: 'delete_dead_channels' }], conversationId: 'conv-9' });

    const result = await taskService.run('user-1', 'task-1');

    expect(mockChat).toHaveBeenCalledWith('user-1', expect.objectContaining({
      message: TASK_ROW.prompt,
      playlistId: 'pl-1',
      allowDestructive: true,
      requireApproval: false,
      isTaskRun: true,
    }));
    expect(result.status).toBe('ok');
  });

  test('records a run that stopped on an approval as needs_approval', async () => {
    let updatePayload;
    mockTables({
      ai_tasks: () => {
        const query = builder({ first: TASK_ROW });
        query.update = jest.fn((payload) => { updatePayload = payload; return { then: (resolve) => resolve(1) }; });
        return query;
      },
    });
    mockChat.mockResolvedValue({ reply: '', steps: [], pendingApproval: { tool: 'delete_channels' } });

    await taskService.run('user-1', 'task-1');

    expect(updatePayload.last_status).toBe('needs_approval');
    expect(updatePayload.last_result).toMatch(/onay/i);
  });

  test('records a failure and rethrows', async () => {
    let updatePayload;
    mockTables({
      ai_tasks: () => {
        const query = builder({ first: TASK_ROW });
        query.update = jest.fn((payload) => { updatePayload = payload; return { then: (resolve) => resolve(1) }; });
        return query;
      },
    });
    mockChat.mockRejectedValue(new Error('sağlayıcı yanıt vermedi'));

    await expect(taskService.run('user-1', 'task-1')).rejects.toThrow(/sağlayıcı/i);
    expect(updatePayload.last_status).toBe('error');
    expect(updatePayload.run_count).toBe(4);
  });

  test('claim succeeds once and reports failure when nothing was due', async () => {
    mockTables({ ai_tasks: () => builder({ updated: 1 }) });
    await expect(taskService.claim('task-1')).resolves.toBe(true);

    mockTables({ ai_tasks: () => builder({ updated: 0 }) });
    await expect(taskService.claim('task-1')).resolves.toBe(false);
  });

  test('a missing task is reported, not silently ignored', async () => {
    mockTables({ ai_tasks: () => builder({ first: undefined }) });
    await expect(taskService.run('user-1', 'yok')).rejects.toThrow(/bulunamadı/i);
    expect(mockChat).not.toHaveBeenCalled();
  });
});
