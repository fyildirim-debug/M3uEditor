const { EventEmitter } = require('events');

const mockImportFromXtream = jest.fn();
const mockSyncFromXtream = jest.fn();
jest.mock('../../../src/services/ImportService', () => (
  jest.fn().mockImplementation(() => ({
    importFromXtream: mockImportFromXtream,
    syncFromXtream: mockSyncFromXtream,
  }))
));

const config = require('../../../src/config');
const importController = require('../../../src/controllers/importController');

function requestFixture(userId, playlistId = 'playlist-1') {
  return Object.assign(new EventEmitter(), {
    userId,
    params: { id: playlistId },
    body: { serverUrl: 'https://provider.example.com', username: 'user', password: 'secret' },
    aborted: false,
    complete: true,
  });
}

function responseFixture() {
  const response = new EventEmitter();
  response.writableEnded = false;
  response.json = jest.fn((value) => {
    response.writableEnded = true;
    return value;
  });
  return response;
}

function deferredImport() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function nextTurn() {
  await new Promise((resolve) => setImmediate(resolve));
}

describe('import concurrency gate', () => {
  beforeEach(() => {
    mockImportFromXtream.mockReset();
    mockSyncFromXtream.mockReset();
  });

  test('rejects a second concurrent import for the same user with 409', async () => {
    const pending = deferredImport();
    mockImportFromXtream.mockReturnValueOnce(pending.promise);
    const firstNext = jest.fn();
    const firstResponse = responseFixture();
    const first = importController.importFromXtream(
      requestFixture('user-1', 'playlist-1'),
      firstResponse,
      firstNext
    );
    await nextTurn();

    const secondNext = jest.fn();
    await importController.importFromXtream(
      requestFixture('user-1', 'playlist-2'),
      responseFixture(),
      secondNext
    );

    expect(secondNext).toHaveBeenCalledWith(expect.objectContaining({
      code: 'IMPORT_IN_PROGRESS',
      statusCode: 409,
    }));
    expect(mockImportFromXtream).toHaveBeenCalledTimes(1);

    pending.resolve({ totalChannels: 1 });
    await first;
    expect(firstNext).not.toHaveBeenCalled();
    expect(firstResponse.json).toHaveBeenCalledWith({ totalChannels: 1 });
  });

  test('rejects concurrent work for the same playlist even across user keys', async () => {
    const pending = deferredImport();
    mockSyncFromXtream.mockReturnValueOnce(pending.promise);
    const first = importController.syncPlaylist(
      requestFixture('user-1', 'shared-playlist'),
      responseFixture(),
      jest.fn()
    );
    await nextTurn();

    const secondNext = jest.fn();
    await importController.syncPlaylist(
      requestFixture('user-2', 'shared-playlist'),
      responseFixture(),
      secondNext
    );

    expect(secondNext).toHaveBeenCalledWith(expect.objectContaining({ code: 'IMPORT_IN_PROGRESS' }));
    expect(mockSyncFromXtream).toHaveBeenCalledTimes(1);
    pending.resolve({});
    await first;
  });

  test('enforces the configurable global concurrency ceiling', async () => {
    const previousLimit = config.imports.maxConcurrent;
    config.imports.maxConcurrent = 1;
    const pending = deferredImport();
    mockImportFromXtream.mockReturnValueOnce(pending.promise);
    const first = importController.importFromXtream(
      requestFixture('user-1', 'playlist-1'),
      responseFixture(),
      jest.fn()
    );
    await nextTurn();

    try {
      const secondNext = jest.fn();
      await importController.importFromXtream(
        requestFixture('user-2', 'playlist-2'),
        responseFixture(),
        secondNext
      );
      expect(secondNext).toHaveBeenCalledWith(expect.objectContaining({
        code: 'IMPORT_CAPACITY_REACHED',
        statusCode: 503,
      }));
    } finally {
      config.imports.maxConcurrent = previousLimit;
      pending.resolve({});
      await first;
    }
  });

  test('aborts the active job when the request closes prematurely', async () => {
    let capturedSignal;
    mockImportFromXtream.mockImplementationOnce((_userId, _credentials, _progress, _playlistId, context) => {
      capturedSignal = context.signal;
      return new Promise((resolve, reject) => {
        context.signal.addEventListener('abort', () => reject(context.signal.reason), { once: true });
      });
    });
    const req = requestFixture('user-1');
    const next = jest.fn();
    const running = importController.importFromXtream(req, responseFixture(), next);
    await nextTurn();

    req.aborted = true;
    req.emit('close');
    await running;

    expect(capturedSignal.aborted).toBe(true);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'IMPORT_CANCELLED' }));
  });

  test('expires and releases a stale lock after the configured TTL', async () => {
    const previousTtl = config.imports.jobTtlMs;
    config.imports.jobTtlMs = 20;
    mockImportFromXtream.mockImplementationOnce((_userId, _credentials, _progress, _playlistId, context) => (
      new Promise((resolve, reject) => {
        context.signal.addEventListener('abort', () => reject(context.signal.reason), { once: true });
      })
    ));
    const expiredNext = jest.fn();

    try {
      await importController.importFromXtream(
        requestFixture('user-ttl', 'playlist-ttl'),
        responseFixture(),
        expiredNext
      );
      expect(expiredNext).toHaveBeenCalledWith(expect.objectContaining({ code: 'IMPORT_CANCELLED' }));

      mockImportFromXtream.mockResolvedValueOnce({ released: true });
      const retriedNext = jest.fn();
      const retriedResponse = responseFixture();
      await importController.importFromXtream(
        requestFixture('user-ttl', 'playlist-ttl'),
        retriedResponse,
        retriedNext
      );
      expect(retriedNext).not.toHaveBeenCalled();
      expect(retriedResponse.json).toHaveBeenCalledWith({ released: true });
    } finally {
      config.imports.jobTtlMs = previousTtl;
    }
  });
});
