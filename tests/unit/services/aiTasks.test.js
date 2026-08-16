/**
 * Zamanlanmis asistan gorevleri: dogrulama, sahiplenme ve calistirma.
 */

const mockDb = jest.fn();
mockDb.fn = { now: jest.fn(() => 'NOW') };
jest.mock('../../../src/config/database', () => mockDb);

const mockChat = jest.fn();
jest.mock('../../../src/services/AIService', () => ({ chat: (...args) => mockChat(...args) }));

const mockCreateBackup = jest.fn();
const mockRestoreBackup = jest.fn();
jest.mock('../../../src/services/BackupService', () => ({
  createBackup: (...args) => mockCreateBackup(...args),
  restoreBackup: (...args) => mockRestoreBackup(...args),
}));

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
  // Varsayilan zincir bir satir dondurur: run() calistirma satirini
  // insert().returning() ile aciyor ve bos dizi undefined'a yol aciyor.
  mockDb.mockImplementation((table) => (tables[table] || (() => builder({ returning: [{ id: 'row-1' }] })))());
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


describe('AI task run log', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateBackup.mockResolvedValue({ id: 'backup-1' });
  });

  /** run() once yedek alir, satir acar, sonra sonucu ayni satira yazar. */
  function runTables({ playlistId = 'pl-1' } = {}) {
    const inserted = {};
    const updates = [];
    mockTables({
      ai_tasks: () => {
        const query = builder({ first: { ...TASK_ROW, playlist_id: playlistId } });
        query.update = jest.fn(() => ({ then: (resolve) => resolve(1) }));
        return query;
      },
      ai_task_runs: () => {
        const query = builder({ returning: [{ id: 'run-1' }] });
        query.insert = jest.fn((row) => { Object.assign(inserted, row); return { returning: jest.fn().mockResolvedValue([{ id: 'run-1', ...row }]) }; });
        query.update = jest.fn((patch) => { updates.push(patch); return { then: (resolve) => resolve(1) }; });
        return query;
      },
      channels: () => builder({ first: { count: '20' } }),
      categories: () => builder({ first: { count: '3' } }),
    });
    return { inserted, updates };
  }

  test('takes a backup before running and marks the run undoable', async () => {
    const { inserted } = runTables();
    mockChat.mockResolvedValue({ reply: 'bitti', steps: [{ tool: 'delete_dead_channels', ok: true, destructive: true }] });

    await taskService.run('user-1', 'task-1');

    expect(mockCreateBackup).toHaveBeenCalledWith('user-1', 'pl-1', 'ai-task');
    expect(inserted.backup_id).toBe('backup-1');
    expect(inserted.undoable).toBe(true);
  });

  test('records the tool trace and the before/after counts', async () => {
    const { updates } = runTables();
    mockChat.mockResolvedValue({ reply: 'bitti', steps: [{ tool: 'import_xtream', ok: true }, { tool: 'auto_match_epg', ok: true }] });

    await taskService.run('user-1', 'task-1');

    const [patch] = updates;
    expect(patch.status).toBe('ok');
    expect(patch.tool_count).toBe(2);
    expect(JSON.parse(patch.steps).map((step) => step.tool)).toEqual(['import_xtream', 'auto_match_epg']);
    expect(JSON.parse(patch.changes)).toMatchObject({ channelsBefore: 20, channelsAfter: 20 });
  });

  test('a run without a playlist is logged but not undoable', async () => {
    const { inserted } = runTables({ playlistId: null });
    mockChat.mockResolvedValue({ reply: 'bitti', steps: [] });

    await taskService.run('user-1', 'task-1');

    // Yedeklenecek liste yok: gorev yine calisir, ama geri alma sunulmaz.
    expect(mockCreateBackup).not.toHaveBeenCalled();
    expect(inserted.undoable).toBe(false);
  });

  test('a failed backup does not cancel the run, it disables undo', async () => {
    mockCreateBackup.mockRejectedValue(new Error('disk dolu'));
    const { inserted } = runTables();
    mockChat.mockResolvedValue({ reply: 'bitti', steps: [] });

    await taskService.run('user-1', 'task-1');

    expect(mockChat).toHaveBeenCalled();
    expect(inserted.undoable).toBe(false);
  });

  test('a failing run is logged with its error', async () => {
    const { updates } = runTables();
    mockChat.mockRejectedValue(new Error('sağlayıcı yanıt vermedi'));

    await expect(taskService.run('user-1', 'task-1')).rejects.toThrow();
    expect(updates[0]).toMatchObject({ status: 'error' });
    expect(updates[0].error).toMatch(/sağlayıcı/i);
  });
});

describe('AI task run undo', () => {
  beforeEach(() => jest.clearAllMocks());

  function runRow(overrides = {}) {
    return {
      id: 'run-1', user_id: 'user-1', task_id: 'task-1', playlist_id: 'pl-1',
      backup_id: 'backup-1', undoable: true, undone_at: null, ...overrides,
    };
  }

  test('restores the pre-run backup and marks the run undone', async () => {
    let patch;
    mockTables({
      ai_task_runs: () => {
        const query = builder({ first: runRow() });
        query.update = jest.fn((value) => { patch = value; return { then: (resolve) => resolve(1) }; });
        return query;
      },
    });
    mockRestoreBackup.mockResolvedValue({ channelCount: 20, categoryCount: 3 });

    const result = await taskService.undoRun('user-1', 'run-1');

    expect(mockRestoreBackup).toHaveBeenCalledWith('user-1', 'backup-1', 'pl-1');
    expect(result).toMatchObject({ undone: true, restored: { channels: 20, categories: 3 } });
    expect(patch.undone_at).toBeDefined();
  });

  test('refuses to undo twice', async () => {
    mockTables({ ai_task_runs: () => builder({ first: runRow({ undone_at: new Date() }) }) });
    await expect(taskService.undoRun('user-1', 'run-1')).rejects.toThrow(/zaten geri alındı/i);
    expect(mockRestoreBackup).not.toHaveBeenCalled();
  });

  test('refuses when the backup is gone', async () => {
    // Yedek retention'a takilip silinmis olabilir; satir kalir, geri alma kapanir.
    mockTables({ ai_task_runs: () => builder({ first: runRow({ backup_id: null }) }) });
    await expect(taskService.undoRun('user-1', 'run-1')).rejects.toThrow(/yedeği yok/i);
  });

  test('another user cannot undo someone else\'s run', async () => {
    mockTables({ ai_task_runs: () => builder({ first: undefined }) });
    await expect(taskService.undoRun('user-2', 'run-1')).rejects.toThrow(/bulunamadı/i);
    expect(mockRestoreBackup).not.toHaveBeenCalled();
  });
});
