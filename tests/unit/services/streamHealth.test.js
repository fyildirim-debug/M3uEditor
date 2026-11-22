const mockDb = jest.fn();
mockDb.raw = jest.fn().mockResolvedValue({ rowCount: 0 });
jest.mock('../../../src/config/database', () => mockDb);

const mockRequestBuffer = jest.fn();
jest.mock('../../../src/utils/safeFetch', () => ({
  requestBuffer: (...args) => mockRequestBuffer(...args),
  requestStream: jest.fn(),
}));

const config = require('../../../src/config');
const healthService = require('../../../src/services/StreamHealthService');

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function playlistQuery() {
  const q = { where: jest.fn(() => q), first: jest.fn().mockResolvedValue({ id: 'p1' }) };
  return q;
}

function channelQuery(rowsPromise) {
  const q = {};
  for (const method of ['where', 'select', 'orderBy', 'andWhere']) q[method] = jest.fn(() => q);
  q.then = (resolve, reject) => Promise.resolve(rowsPromise).then(resolve, reject);
  return q;
}

async function settle() {
  for (let index = 0; index < 20; index += 1) await new Promise((resolve) => setImmediate(resolve));
}

describe('StreamHealthService', () => {
  const originalHealthConfig = { ...config.healthScan };

  beforeEach(() => {
    jest.clearAllMocks();
    healthService.jobsByUser.clear();
    Object.assign(config.healthScan, originalHealthConfig);
  });

  afterAll(() => Object.assign(config.healthScan, originalHealthConfig));

  test('registers the job before the first await so concurrent starts share one scan', async () => {
    const rows = deferred();
    mockDb.mockImplementation((table) => (table === 'playlists' ? playlistQuery() : channelQuery(rows.promise)));
    mockRequestBuffer.mockResolvedValue({ status: 200 });

    const first = healthService.scanPlaylist('user-1', 'p1');
    const second = healthService.scanPlaylist('user-1', 'p1');
    rows.resolve([{ id: 'c1', stream_url: 'http://a.example/1' }]);
    const [jobA, jobB] = await Promise.all([first, second]);

    expect(jobA).toBe(jobB);
    // Kanal listesi yalnizca bir kez okunur
    expect(mockDb.mock.calls.filter(([table]) => table === 'channels')).toHaveLength(1);
    await settle();
    expect(jobA.running).toBe(false);
  });

  test('caps the number of scans running on the server', async () => {
    config.healthScan.maxJobs = 1;
    const pending = deferred();
    mockDb.mockImplementation((table) => (table === 'playlists' ? playlistQuery() : channelQuery([{ id: 'c1', stream_url: 'http://a.example/1' }])));
    mockRequestBuffer.mockReturnValue(pending.promise);

    await healthService.scanPlaylist('user-1', 'p1');
    await expect(healthService.scanPlaylist('user-2', 'p1')).rejects.toMatchObject({ code: 'HEALTH_SCAN_CAPACITY_REACHED', statusCode: 503 });

    pending.resolve({ status: 200 });
    await settle();
    await expect(healthService.scanPlaylist('user-2', 'p1')).resolves.toMatchObject({ running: true });
    await settle();
  });

  test('never sends more than the per-host limit to one provider at a time', async () => {
    config.healthScan.perHostConcurrency = 2;
    const channels = [
      ...Array.from({ length: 8 }, (_, index) => ({ id: `a${index}`, stream_url: `http://provider-a.example/${index}` })),
      ...Array.from({ length: 3 }, (_, index) => ({ id: `b${index}`, stream_url: `http://provider-b.example/${index}` })),
    ];
    mockDb.mockImplementation((table) => (table === 'playlists' ? playlistQuery() : channelQuery(channels)));
    const inflight = new Map();
    const peak = new Map();
    mockRequestBuffer.mockImplementation(async (url) => {
      const host = new URL(url).host;
      inflight.set(host, (inflight.get(host) || 0) + 1);
      peak.set(host, Math.max(peak.get(host) || 0, inflight.get(host)));
      await new Promise((resolve) => setImmediate(resolve));
      inflight.set(host, inflight.get(host) - 1);
      return { status: 200 };
    });

    const job = await healthService.scanPlaylist('user-3', 'p1');
    await settle();
    await settle();

    expect(job.running).toBe(false);
    expect(job.checked).toBe(11);
    expect(peak.get('provider-a.example')).toBe(2);
    expect(peak.get('provider-b.example')).toBe(2);
  });

  test('marks the job finished when loading channels fails', async () => {
    mockDb.mockImplementation((table) => (table === 'playlists' ? playlistQuery() : channelQuery(Promise.reject(new Error('db down')))));

    await expect(healthService.scanPlaylist('user-4', 'p1')).rejects.toThrow('db down');
    const job = healthService.jobsByUser.get('user-4');
    expect(job).toMatchObject({ running: false, error: 'db down' });
  });
});
