const mockDb = jest.fn();
mockDb.fn = { now: jest.fn(() => 'NOW') };
mockDb.transaction = jest.fn();
mockDb.raw = jest.fn();
jest.mock('../../../src/config/database', () => mockDb);

const mockRequestStream = jest.fn();
jest.mock('../../../src/utils/safeFetch', () => ({
  requestStream: (...args) => mockRequestStream(...args),
  parseRemoteUrl: jest.requireActual('../../../src/utils/safeFetch').parseRemoteUrl,
}));

const { Readable } = require('stream');
const EPGService = require('../../../src/services/EPGService');
const { encrypt } = require('../../../src/utils/crypto');

function builder({ rows = [], first = undefined, updated = 1, returning = [] } = {}) {
  const query = {};
  for (const method of ['where', 'whereNull', 'whereNot', 'orWhere', 'orWhereNull', 'andWhere', 'join', 'select', 'orderBy', 'limit', 'whereIn', 'forUpdate', 'insert', 'del', 'onConflict', 'ignore']) {
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
    expect(mockRequestStream).not.toHaveBeenCalled();
  });

  test('marks a source as errored but preserves existing EPG data when fetching fails', async () => {
    const source = { id: 'source-1', url: encrypt('https://epg.example.com/data.xml') };
    const sourceQuery = builder({ first: source, updated: 1 });
    sourceQuery.update = jest.fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    mockDb.mockReturnValue(sourceQuery);
    mockRequestStream.mockRejectedValue(new Error('offline'));

    await expect(service.parseAndStore('source-1')).rejects.toMatchObject({ code: 'EPG_FETCH_FAILED' });
    expect(sourceQuery.update).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'error' }));
    expect(mockDb).not.toHaveBeenCalledWith('epg_channels');
  });

  test('matches exact and partial names with one set-based update statement', async () => {
    mockDb.raw.mockResolvedValue({ rows: [{
      total: 2,
      matches: [
        { channelId: 'c1', epgChannelId: 'bbc.news', epgSourceId: 's1', confidence: 1 },
        { channelId: 'c2', epgChannelId: 'sports.hd', epgSourceId: 's2', confidence: 0.5 },
      ],
    }] });

    const result = await service.autoMatch('user-1', 'playlist-1');

    expect(result).toEqual(expect.objectContaining({ matched: 2, total: 2 }));
    expect(result.matches.map((item) => item.confidence)).toEqual([1, 0.5]);
    expect(mockDb.raw).toHaveBeenCalledTimes(1);
    expect(mockDb.raw.mock.calls[0][0]).toEqual(expect.stringMatching(/channel_tokens[\s\S]+similarity\([\s\S]+UPDATE channels/));
    expect(mockDb.raw.mock.calls[0][1]).toEqual(['playlist-1', 'user-1', 'user-1']);
  });

  test('rejects empty or sharply reduced guides unless force is explicit', () => {
    expect(() => service._validateReplacement({
      old_channel_count: 20, old_program_count: 200,
      new_channel_count: 9, new_program_count: 99,
    })).toThrow(/kanal sayısı 20 -> 9, program sayısı 200 -> 99/);
    expect(() => service._validateReplacement({
      old_channel_count: 0, old_program_count: 0,
      new_channel_count: 1, new_program_count: 0,
    })).toThrow(/yeni rehber boş/);
    expect(() => service._validateReplacement({
      old_channel_count: 20, old_program_count: 200,
      new_channel_count: 1, new_program_count: 1,
    }, true)).not.toThrow();
  });

  test('streams valid XMLTV into staging batches before replacing the source', async () => {
    const source = { id: 'source-1', url: encrypt('https://epg.example.com/data.xml') };
    const sourceQuery = builder({ first: source });
    sourceQuery.update = jest.fn().mockResolvedValue(1);
    mockDb.mockReturnValue(sourceQuery);
    mockRequestStream.mockResolvedValue({ stream: Readable.from([
      '<tv><channel id="ch1"><display-name>News</display-name></channel>',
      '<programme start="20240101120000 +0000" channel="ch1"><title>Noon</title></programme></tv>',
    ]) });

    const stageChannels = builder();
    const stagePrograms = builder();
    const liveChannels = builder();
    const liveSources = builder();
    const trx = jest.fn((table) => ({
      epg_stage_channels: stageChannels,
      epg_stage_programs: stagePrograms,
      epg_channels: liveChannels,
      epg_sources: liveSources,
    }[table]));
    trx.fn = mockDb.fn;
    trx.raw = jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{
        old_channel_count: 1, old_program_count: 1,
        new_channel_count: 1, new_program_count: 1,
      }] })
      .mockResolvedValue({ rows: [] });
    mockDb.transaction.mockImplementation((callback) => callback(trx));

    await expect(service.parseAndStore('source-1')).resolves.toEqual({ channelCount: 1, programCount: 1 });
    expect(mockRequestStream).toHaveBeenCalledTimes(1);
    expect(stageChannels.insert).toHaveBeenCalledWith([expect.objectContaining({ channel_id: 'ch1' })]);
    expect(stagePrograms.insert).toHaveBeenCalledWith([expect.objectContaining({ channel_id: 'ch1', title: 'Noon' })]);
    const reconciliationSql = trx.raw.mock.calls.map(([sql]) => sql).join('\n');
    expect(reconciliationSql).toMatch(/UPDATE epg_channels AS live/);
    expect(reconciliationSql).toMatch(/old_ranked[\s\S]+DELETE FROM epg_programs/);
    expect(reconciliationSql).toMatch(/live_ranked[\s\S]+INSERT INTO epg_programs/);
    expect(liveSources.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }));
  });

  test('rolls back staged data and never deletes the live guide when the stream is truncated', async () => {
    const source = { id: 'source-1', url: encrypt('https://epg.example.com/data.xml') };
    const sourceQuery = builder({ first: source });
    sourceQuery.update = jest.fn().mockResolvedValue(1);
    const liveChannels = builder();
    mockDb.mockImplementation((table) => table === 'epg_channels' ? liveChannels : sourceQuery);
    mockRequestStream.mockResolvedValue({ stream: Readable.from([
      '<tv><channel id="ch1"><display-name>News</display-name></channel>',
      '<programme start="20240101120000 +0000" channel="ch1"><title>cut',
    ]) });
    const trx = jest.fn((table) => table === 'epg_channels' ? liveChannels : builder());
    trx.fn = mockDb.fn;
    trx.raw = jest.fn().mockResolvedValue({ rows: [] });
    mockDb.transaction.mockImplementation((callback) => callback(trx));

    await expect(service.parseAndStore('source-1')).rejects.toMatchObject({ code: 'EPG_FETCH_FAILED' });
    expect(liveChannels.del).not.toHaveBeenCalled();
    expect(sourceQuery.update).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'error' }));
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
