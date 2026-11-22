const mockDb = jest.fn();
mockDb.fn = { now: jest.fn(() => 'NOW') };
jest.mock('../../../src/config/database', () => mockDb);

const { backoffMinutes, nextAttemptAt } = require('../../../src/utils/backoff');
const scheduler = require('../../../src/services/SchedulerService');

function query(rows = []) {
  const q = {};
  for (const method of ['where', 'whereNotNull', 'whereNull', 'orWhere', 'whereRaw', 'andWhereRaw', 'select']) {
    q[method] = jest.fn(() => q);
  }
  q.andWhere = jest.fn((callback) => {
    if (typeof callback === 'function') callback(q);
    return q;
  });
  q.update = jest.fn().mockResolvedValue(1);
  q.then = (resolve, reject) => Promise.resolve(rows).then(resolve, reject);
  return q;
}

describe('scheduler backoff', () => {
  test('doubles the wait after each consecutive failure, bounded to 5 minutes .. 24 hours', () => {
    expect(backoffMinutes(60, 1)).toBe(60);
    expect(backoffMinutes(60, 2)).toBe(120);
    expect(backoffMinutes(60, 3)).toBe(240);
    expect(backoffMinutes(1, 1)).toBe(5);
    expect(backoffMinutes(360, 10)).toBe(24 * 60);
    expect(backoffMinutes(null, 1)).toBe(5);
    const now = new Date('2026-11-22T00:00:00Z');
    expect(nextAttemptAt(30, 2, now).toISOString()).toBe('2026-11-22T01:00:00.000Z');
  });
});

describe('SchedulerService', () => {
  let tables;

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler.handlers.clear();
    scheduler.running = false;
    tables = {};
    mockDb.mockImplementation((table) => {
      const queue = tables[table] || [];
      return queue.length ? queue.shift() : query([]);
    });
  });

  test('due queries respect next_attempt_at and clamp short intervals to the configured floor', async () => {
    const playlists = query([]);
    const epg = query([]);
    tables.playlists = [playlists];
    tables.epg_sources = [epg];
    scheduler.register('playlist-sync', jest.fn());
    scheduler.register('epg-refresh', jest.fn());

    await scheduler._tick();

    expect(playlists.whereNull).toHaveBeenCalledWith('sync_next_attempt_at');
    expect(playlists.orWhere).toHaveBeenCalledWith('sync_next_attempt_at', '<=', expect.any(Date));
    expect(playlists.whereRaw).toHaveBeenCalledWith(expect.stringContaining('GREATEST(sync_interval_minutes, ?)'), [15, expect.any(Date)]);
    expect(epg.whereNull).toHaveBeenCalledWith('next_attempt_at');
    expect(epg.whereRaw).toHaveBeenCalledWith(expect.stringContaining('GREATEST(refresh_interval_minutes, ?)'), [15, expect.any(Date)]);
  });

  test('a failed sync increments the failure count and schedules the next attempt', async () => {
    const due = query([{ id: 'p1', user_id: 'u1', sync_interval_minutes: 60, sync_failure_count: 1 }]);
    const record = query();
    tables.playlists = [due, record];
    scheduler.register('playlist-sync', jest.fn().mockRejectedValue(new Error('provider down')));

    const before = Date.now();
    await scheduler._tick();

    expect(record.where).toHaveBeenCalledWith({ id: 'p1' });
    const payload = record.update.mock.calls[0][0];
    expect(payload.sync_failure_count).toBe(2);
    // ikinci ardisik hata: 60 * 2 dakika
    expect(payload.sync_next_attempt_at.getTime() - before).toBeGreaterThanOrEqual(120 * 60_000 - 1000);
    expect(payload.sync_next_attempt_at.getTime() - before).toBeLessThanOrEqual(120 * 60_000 + 5000);
  });

  test('a partial sync counts as a failure because it does not advance last_synced_at', async () => {
    const due = query([{ id: 'p1', user_id: 'u1', sync_interval_minutes: 360, sync_failure_count: 0 }]);
    const record = query();
    tables.playlists = [due, record];
    scheduler.register('playlist-sync', jest.fn().mockResolvedValue({ partial: true }));

    await scheduler._tick();

    expect(record.update).toHaveBeenCalledWith(expect.objectContaining({ sync_failure_count: 1 }));
  });

  test('a successful run resets a previous failure streak', async () => {
    const due = query([{ id: 'p1', user_id: 'u1', sync_interval_minutes: 360, sync_failure_count: 3 }]);
    const record = query();
    tables.playlists = [due, record];
    scheduler.register('playlist-sync', jest.fn().mockResolvedValue({ partial: false }));

    await scheduler._tick();

    expect(record.update).toHaveBeenCalledWith({ sync_failure_count: 0, sync_next_attempt_at: null });
  });

  test('a run skipped because an import holds the lock records nothing', async () => {
    const due = query([{ id: 'p1', user_id: 'u1', sync_interval_minutes: 360, sync_failure_count: 2 }]);
    tables.playlists = [due];
    scheduler.register('playlist-sync', jest.fn().mockResolvedValue({ skipped: true }));

    await scheduler._tick();

    expect(mockDb).toHaveBeenCalledTimes(1);
  });

  test('EPG refreshes run with bounded parallelism and back off on failure', async () => {
    const due = query([
      { id: 's1', user_id: 'u1', refresh_interval_minutes: 360, failure_count: 0 },
      { id: 's2', user_id: 'u1', refresh_interval_minutes: 360, failure_count: 0 },
      { id: 's3', user_id: 'u1', refresh_interval_minutes: 360, failure_count: 0 },
    ]);
    const record = query();
    tables.epg_sources = [due, record];
    let active = 0;
    let peak = 0;
    const handler = jest.fn(async ({ id }) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setImmediate(resolve));
      active -= 1;
      if (id === 's2') throw new Error('bad guide');
    });
    scheduler.register('epg-refresh', handler);

    await scheduler._tick();

    expect(handler).toHaveBeenCalledTimes(3);
    expect(peak).toBe(2);
    expect(record.where).toHaveBeenCalledWith({ id: 's2' });
    expect(record.update).toHaveBeenCalledWith(expect.objectContaining({ failure_count: 1, next_attempt_at: expect.any(Date) }));
  });
});
