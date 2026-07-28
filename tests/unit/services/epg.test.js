const mockDb = jest.fn();
mockDb.fn = { now: jest.fn(() => 'NOW') };
mockDb.transaction = jest.fn();
jest.mock('../../../src/config/database', () => mockDb);

const mockSafeFetchText = jest.fn();
jest.mock('../../../src/utils/safeFetch', () => ({
  safeFetchText: (...args) => mockSafeFetchText(...args),
  parseRemoteUrl: jest.requireActual('../../../src/utils/safeFetch').parseRemoteUrl,
}));

const EPGService = require('../../../src/services/EPGService');
const { encrypt } = require('../../../src/utils/crypto');

function builder({ rows = [], first = undefined, updated = 1, returning = [] } = {}) {
  const query = {};
  for (const method of ['where', 'whereNull', 'whereNot', 'orWhere', 'orWhereNull', 'andWhere', 'join', 'select', 'orderBy', 'limit', 'whereIn', 'forUpdate', 'insert', 'del']) {
    query[method] = jest.fn(() => query);
  }
  query.first = jest.fn().mockResolvedValue(first);
  query.update = jest.fn(() => query);
  query.returning = jest.fn().mockResolvedValue(returning);
  query.then = (resolve, reject) => Promise.resolve(rows).then(resolve, reject);
  query.valueOf = () => updated;
  return new Proxy(query, {
    get(target, property) {
      if (property === Symbol.toPrimitive) return () => updated;
      if (property === 'then') return target.then;
      return target[property];
    },
  });
}

describe('EPGService', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EPGService();
  });

  test('adds an encrypted source and only returns a redacted URL', async () => {
    const inserted = { id: 'source-1', user_id: 'user-1', url: encrypt('https://epg.example.com/private.xml?token=secret'), status: 'pending' };
    const sourceQuery = builder({ rows: [], first: undefined, returning: [inserted] });
    mockDb.mockReturnValue(sourceQuery);

    const result = await service.addSource('user-1', 'https://epg.example.com/private.xml?token=secret');

    expect(result).toEqual(expect.objectContaining({ id: 'source-1', url: 'https://epg.example.com/private.xml' }));
    const insertedPayload = sourceQuery.insert.mock.calls[0][0];
    expect(insertedPayload.url).toMatch(/^enc:v1:/);
    expect(insertedPayload.url_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  test('rejects invalid source URLs before database work', async () => {
    await expect(service.addSource('user-1', 'file:///etc/passwd')).rejects.toBeDefined();
    expect(mockDb).not.toHaveBeenCalled();
  });

  test('fails fast when parsing an unknown source', async () => {
    mockDb.mockReturnValue(builder({ first: undefined }));
    await expect(service.parseAndStore('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(mockSafeFetchText).not.toHaveBeenCalled();
  });

  test('marks a source as errored but preserves existing EPG data when fetching fails', async () => {
    const source = { id: 'source-1', url: encrypt('https://epg.example.com/data.xml') };
    const sourceQuery = builder({ first: source, updated: 1 });
    sourceQuery.update = jest.fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    mockDb.mockReturnValue(sourceQuery);
    mockSafeFetchText.mockRejectedValue(new Error('offline'));

    await expect(service.parseAndStore('source-1')).rejects.toMatchObject({ code: 'EPG_FETCH_FAILED' });
    expect(sourceQuery.update).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'error' }));
    expect(mockDb).not.toHaveBeenCalledWith('epg_channels');
  });

  test('matches exact and partial channel names and persists source-scoped mappings', async () => {
    const channels = builder({ rows: [
      { id: 'c1', name: 'BBC News' },
      { id: 'c2', name: 'Sports Live TV' },
    ] });
    const epgChannels = builder({ rows: [
      { channel_id: 'bbc.news', source_id: 's1', display_name: 'BBC News' },
      { channel_id: 'sports.hd', source_id: 's2', display_name: 'Sports HD' },
    ] });
    mockDb.mockImplementation((table) => table === 'channels' ? channels : epgChannels);
    const transactionChannel = builder();
    const trx = jest.fn(() => transactionChannel);
    trx.fn = mockDb.fn;
    mockDb.transaction.mockImplementation((callback) => callback(trx));

    const result = await service.autoMatch('user-1', 'playlist-1');

    expect(result).toEqual(expect.objectContaining({ matched: 2, total: 2 }));
    expect(result.matches.map((item) => item.confidence)).toEqual([1, 0.5]);
    expect(transactionChannel.update).toHaveBeenCalledWith(expect.objectContaining({ epg_source_id: expect.any(String) }));
  });

  test.each([
    ['same', 'same', 1],
    ['bbc news hd', 'bbc news', 0.7],
    ['sports live', 'sports hd', 0.5],
    ['alpha', 'omega', 0],
  ])('calculates bounded similarity for %s and %s', (a, b, expected) => {
    expect(service._calculateSimilarity(a, b)).toBe(expected);
  });
});
