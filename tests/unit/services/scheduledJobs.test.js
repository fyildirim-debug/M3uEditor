const mockDb = jest.fn();
mockDb.fn = { now: jest.fn(() => 'NOW') };
jest.mock('../../../src/config/database', () => mockDb);

const importJobs = require('../../../src/services/ImportJobs');
const { createPlaylistSyncHandler } = require('../../../src/services/ScheduledJobs');

function playlistQuery(playlist) {
  const q = { where: jest.fn(() => q), first: jest.fn().mockResolvedValue(playlist) };
  return q;
}

describe('scheduled playlist sync handler', () => {
  let importService;
  let backupService;

  beforeEach(() => {
    jest.clearAllMocks();
    importService = {
      previewSync: jest.fn().mockResolvedValue({
        types: { live: { available: true, categories: [{ id: '1', selected: true }, { id: '2', selected: false }] } },
      }),
      syncFromXtream: jest.fn().mockResolvedValue({ partial: false }),
    };
    backupService = { createBackup: jest.fn().mockResolvedValue({ id: 'backup-1' }) };
  });

  test('takes the import lock, backs up and syncs the previously selected categories', async () => {
    mockDb.mockReturnValue(playlistQuery({ id: 'p1', user_id: 'u1', backup_before_sync: true, sync_failure_count: 0 }));
    const handler = createPlaylistSyncHandler({ importService, backupService });

    let lockedDuringSync = false;
    importService.syncFromXtream.mockImplementation(async () => {
      lockedDuringSync = importJobs.listUserJobs('u1').some((job) => job.playlistKey === 'p1' && job.kind === 'scheduled-sync');
      return { partial: false };
    });

    await expect(handler({ id: 'p1', user_id: 'u1' })).resolves.toMatchObject({ partial: false });

    expect(backupService.createBackup).toHaveBeenCalledWith('u1', 'p1', 'scheduled');
    expect(importService.syncFromXtream).toHaveBeenCalledWith('u1', 'p1', undefined, expect.objectContaining({ signal: expect.any(Object) }), { categories: { live: ['1'] } });
    expect(lockedDuringSync).toBe(true);
    expect(importJobs.listUserJobs('u1')).toHaveLength(0);
  });

  test('skips the pre-sync backup when the previous scheduled run failed', async () => {
    mockDb.mockReturnValue(playlistQuery({ id: 'p1', user_id: 'u1', backup_before_sync: true, sync_failure_count: 2 }));
    const handler = createPlaylistSyncHandler({ importService, backupService });

    await handler({ id: 'p1', user_id: 'u1', sync_failure_count: 2 });

    expect(backupService.createBackup).not.toHaveBeenCalled();
    expect(importService.syncFromXtream).toHaveBeenCalled();
  });

  test('is skipped without backup or sync while an HTTP import holds the lock', async () => {
    mockDb.mockReturnValue(playlistQuery({ id: 'p1', user_id: 'u1', backup_before_sync: true, sync_failure_count: 0 }));
    const handler = createPlaylistSyncHandler({ importService, backupService });
    const job = importJobs.acquireJob('u1', 'p1');
    try {
      await expect(handler({ id: 'p1', user_id: 'u1' })).resolves.toEqual({ skipped: true });
    } finally {
      importJobs.releaseJob(job);
    }
    expect(backupService.createBackup).not.toHaveBeenCalled();
    expect(importService.syncFromXtream).not.toHaveBeenCalled();
  });

  test('reports a partial sync and releases the lock after a failure', async () => {
    mockDb.mockReturnValue(playlistQuery({ id: 'p1', user_id: 'u1', backup_before_sync: false }));
    const handler = createPlaylistSyncHandler({ importService, backupService });

    importService.syncFromXtream.mockResolvedValueOnce({ partial: true });
    await expect(handler({ id: 'p1', user_id: 'u1' })).resolves.toMatchObject({ partial: true });

    importService.syncFromXtream.mockRejectedValueOnce(new Error('provider down'));
    await expect(handler({ id: 'p1', user_id: 'u1' })).rejects.toThrow('provider down');
    expect(importJobs.listUserJobs('u1')).toHaveLength(0);
  });
});
