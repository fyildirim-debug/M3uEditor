const mockDb = jest.fn();
mockDb.fn = { now: jest.fn(() => 'NOW') };
mockDb.transaction = jest.fn();
jest.mock('../../../src/config/database', () => mockDb);

const importJobs = require('../../../src/services/ImportJobs');
const backupService = require('../../../src/services/BackupService');

function retentionQuery(staleRows, captured) {
  const filters = [];
  const q = {};
  q.where = jest.fn((...args) => { filters.push(['where', ...args]); return q; });
  q.orWhereNotIn = jest.fn((...args) => { filters.push(['orWhereNotIn', ...args]); return q; });
  q.orWhereNull = jest.fn((...args) => { filters.push(['orWhereNull', ...args]); return q; });
  q.andWhere = jest.fn((callback) => { callback(q); return q; });
  q.orderBy = jest.fn(() => q);
  q.offset = jest.fn((value) => { filters.push(['offset', value]); return q; });
  q.select = jest.fn(async () => {
    captured.push(filters);
    const reason = filters.find((entry) => entry[0] === 'where' && entry[1] === 'reason')?.[2];
    return staleRows[reason] || [];
  });
  q.whereIn = jest.fn(() => q);
  q.del = jest.fn().mockResolvedValue(1);
  return q;
}

describe('BackupService retention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(backupService, 'removeBackupFile').mockResolvedValue();
  });

  test('keeps a separate bucket of 10 for each backup kind', async () => {
    const captured = [];
    const queries = [];
    mockDb.mockImplementation(() => {
      const q = retentionQuery({ scheduled: [{ id: 'old-scheduled', filename: 'backups/p/old.json.gz' }] }, captured);
      queries.push(q);
      return q;
    });

    await backupService.enforceRetention('playlist-1');

    const reasons = captured.map((filters) => filters.find((entry) => entry[0] === 'where' && entry[1] === 'reason')?.[2]);
    expect(reasons.sort()).toEqual(['ai-task', 'manual', 'pre-sync', 'scheduled']);
    for (const filters of captured) expect(filters).toContainEqual(['offset', 10]);
    // Elle alinmis yedek kovasi taninmayan eski reason degerlerini de kapsar
    const manual = captured.find((filters) => filters.some((entry) => entry[2] === 'manual'));
    expect(manual.some((entry) => entry[0] === 'orWhereNotIn')).toBe(true);
    // Yalnizca zamanlanmis kovadaki fazlalik silinir; elle alinanlar etkilenmez
    expect(backupService.removeBackupFile).toHaveBeenCalledTimes(1);
    expect(backupService.removeBackupFile).toHaveBeenCalledWith('backups/p/old.json.gz');
  });
});

describe('BackupService restore lock', () => {
  beforeEach(() => jest.clearAllMocks());

  test('refuses to overwrite a playlist while an import holds its lock', async () => {
    const job = importJobs.acquireJob('user-1', 'playlist-1');
    const inner = jest.spyOn(backupService, '_restoreBackup').mockResolvedValue({ playlistId: 'playlist-1' });
    try {
      await expect(backupService.restoreBackup('user-1', 'backup-1', 'playlist-1'))
        .rejects.toMatchObject({ code: 'IMPORT_IN_PROGRESS', statusCode: 409 });
      expect(inner).not.toHaveBeenCalled();
    } finally {
      importJobs.releaseJob(job);
    }

    await expect(backupService.restoreBackup('user-1', 'backup-1', 'playlist-1')).resolves.toEqual({ playlistId: 'playlist-1' });
    expect(importJobs.listUserJobs('user-1')).toHaveLength(0);
    inner.mockRestore();
  });

  test('holds the lock while restoring so a concurrent import is rejected', async () => {
    let release;
    const inner = jest.spyOn(backupService, '_restoreBackup').mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const restoring = backupService.restoreBackup('user-2', 'backup-1', 'playlist-2');
    await new Promise((resolve) => setImmediate(resolve));

    expect(() => importJobs.acquireJob('user-2', 'playlist-2')).toThrow(expect.objectContaining({ code: 'IMPORT_IN_PROGRESS' }));
    release({ playlistId: 'playlist-2' });
    await restoring;
    expect(importJobs.listUserJobs('user-2')).toHaveLength(0);
    inner.mockRestore();
  });
});
