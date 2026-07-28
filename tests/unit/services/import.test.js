const mockDb = jest.fn();
mockDb.fn = { now: jest.fn(() => 'NOW') };
mockDb.transaction = jest.fn();
jest.mock('../../../src/config/database', () => mockDb);

const ImportService = require('../../../src/services/ImportService');
const { decrypt } = require('../../../src/utils/crypto');

function transactionFixture(existingChannels = []) {
  const captures = { updates: [], deletes: 0 };
  const trx = jest.fn((table) => {
    const query = {};
    for (const method of ['where', 'whereIn', 'whereNotNull']) query[method] = jest.fn(() => query);
    query.select = jest.fn().mockResolvedValue(table === 'channels' ? existingChannels : []);
    query.update = jest.fn(async (payload) => { captures.updates.push({ table, payload }); return 1; });
    query.del = jest.fn(async () => { captures.deletes += 1; return 1; });
    return query;
  });
  trx.fn = mockDb.fn;
  return { trx, captures };
}

describe('ImportService', () => {
  let service;
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ImportService();
    client = {
      serverUrl: 'https://provider.example.com',
      buildStreamUrl: jest.fn((type, id, extension) => `https://stream/${type}/${id}.${extension}`),
      getXmltvUrl: jest.fn(() => 'https://provider.example.com/xmltv.php?token=secret'),
    };
    jest.spyOn(service, '_scheduleEpg').mockImplementation(() => {});
  });

  test('normalizes, deduplicates and validates stream types', () => {
    expect(service._normalizeTypes(['live', 'vod', 'live', 'invalid'])).toEqual(['live', 'vod']);
    expect(() => service._normalizeTypes(['invalid'])).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    expect(service._parseStoredTypes('not-json')).toEqual(['live']);
  });

  test('creates a stable source record without placing credentials in extras', () => {
    const record = service._recordForChannel('playlist-1', {
      stream_id: 42,
      name: 'News',
      stream_type: 'live',
      container_extension: 'ts',
      category_id: 'remote-1',
      rating: '5',
    }, { 'remote-1': 'category-1' }, client, 3);

    expect(record).toEqual(expect.objectContaining({
      playlist_id: 'playlist-1', source_id: '42', category_id: 'category-1', sort_order: 3,
    }));
    expect(client.buildStreamUrl).toHaveBeenCalledWith('live', 42, 'ts');
    expect(record.extras).not.toContain('password');
  });

  test('imports fetched data atomically and encrypts stored credentials', async () => {
    jest.spyOn(service, '_fetchXtream').mockResolvedValue({
      categories: [{ category_id: 'remote-1', category_name: 'News' }],
      channels: [{ stream_id: 10, name: 'Channel', stream_type: 'live', container_extension: 'ts', category_id: 'remote-1' }],
      client,
      streamTypes: ['live'],
    });
    jest.spyOn(service, '_getOrCreatePlaylist').mockResolvedValue({ id: 'playlist-1' });
    jest.spyOn(service, '_upsertCategories').mockResolvedValue({ 'remote-1': 'category-1' });
    jest.spyOn(service, '_bulkUpsertChannels').mockResolvedValue();
    const { trx, captures } = transactionFixture();
    mockDb.transaction.mockImplementation((callback) => callback(trx));

    const result = await service.importFromXtream('user-1', {
      serverUrl: 'https://provider.example.com', username: 'user', password: 'secret-password', streamTypes: ['live'],
    });

    expect(result).toEqual(expect.objectContaining({ playlistId: 'playlist-1', added: 1, updated: 0, removed: 0 }));
    const credentialUpdate = captures.updates.find((item) => item.payload.xtream_password_enc);
    expect(credentialUpdate.payload.xtream_password_enc).toMatch(/^enc:v1:/);
    expect(decrypt(credentialUpdate.payload.xtream_password_enc)).toBe('secret-password');
    expect(service._scheduleEpg).toHaveBeenCalledWith('user-1', 'playlist-1', expect.stringContaining('xmltv.php'));
  });

  test('removes stale source records only after a non-empty successful fetch', async () => {
    jest.spyOn(service, '_fetchXtream').mockResolvedValue({
      categories: [],
      channels: [{ stream_id: 2, name: 'Current', stream_type: 'live', container_extension: 'ts' }],
      client,
      streamTypes: ['live'],
    });
    jest.spyOn(service, '_getOrCreatePlaylist').mockResolvedValue({ id: 'playlist-1' });
    jest.spyOn(service, '_upsertCategories').mockResolvedValue({});
    jest.spyOn(service, '_bulkUpsertChannels').mockResolvedValue();
    const { trx, captures } = transactionFixture([
      { source_id: '1', stream_type: 'live' },
      { source_id: '2', stream_type: 'live' },
    ]);
    mockDb.transaction.mockImplementation((callback) => callback(trx));

    const result = await service.importFromXtream('user-1', { username: 'u', password: 'p' });
    expect(result).toEqual(expect.objectContaining({ added: 0, updated: 1, removed: 1 }));
    expect(captures.deletes).toBe(1);
  });

  test('never deletes existing channels when a provider returns an empty list', async () => {
    jest.spyOn(service, '_fetchXtream').mockResolvedValue({ categories: [], channels: [], client, streamTypes: ['live'] });
    jest.spyOn(service, '_getOrCreatePlaylist').mockResolvedValue({ id: 'playlist-1' });
    jest.spyOn(service, '_upsertCategories').mockResolvedValue({});
    jest.spyOn(service, '_bulkUpsertChannels').mockResolvedValue();
    const { trx, captures } = transactionFixture([{ source_id: '1', stream_type: 'live' }]);
    mockDb.transaction.mockImplementation((callback) => callback(trx));

    const result = await service.importFromXtream('user-1', { username: 'u', password: 'p' });
    expect(result.removed).toBe(0);
    expect(captures.deletes).toBe(0);
  });

  test('loads existing categories once and inserts new categories in large batches', async () => {
    const select = jest.fn().mockResolvedValue([{ id: 'existing-id', name: 'Category 0' }]);
    const insertedBatches = [];
    const connection = jest.fn(() => {
      const query = {};
      query.where = jest.fn(() => query);
      query.whereIn = jest.fn(() => query);
      query.select = select;
      query.insert = jest.fn(async (rows) => { insertedBatches.push(rows); });
      return query;
    });
    const categories = Array.from({ length: 2501 }, (_, index) => ({
      category_id: String(index),
      category_name: `Category ${index}`,
    }));

    const categoryMap = await service._upsertCategories('playlist-1', categories, connection);

    expect(select).toHaveBeenCalledTimes(1);
    expect(insertedBatches.map((batch) => batch.length)).toEqual([1000, 1000, 500]);
    expect(categoryMap['0']).toBe('existing-id');
    expect(categoryMap['2500']).toBeTruthy();
  });

  test('writes large channel sets in 1000-row database batches', async () => {
    const insertedBatchSizes = [];
    const connection = jest.fn(() => ({
      insert: jest.fn((rows) => {
        insertedBatchSizes.push(rows.length);
        return { toSQL: () => ({ sql: 'insert into channels', bindings: [] }) };
      }),
    }));
    connection.raw = jest.fn().mockResolvedValue({ rowCount: 0 });
    const onProgress = jest.fn();
    const records = Array.from({ length: 2501 }, (_, index) => ({
      id: `id-${index}`,
      playlist_id: 'playlist-1',
      source_id: String(index),
      stream_type: 'live',
      stream_url: `https://stream/${index}`,
    }));

    await service._bulkUpsertChannels('playlist-1', records, onProgress, connection);

    expect(insertedBatchSizes).toEqual([1000, 1000, 501]);
    expect(connection.raw).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenLastCalledWith({ processed: 2501, total: 2501 });
  });

  test('sync rejects playlists with no saved provider credentials', async () => {
    const query = { where: jest.fn().mockReturnThis(), first: jest.fn().mockResolvedValue({ id: 'playlist-1' }) };
    mockDb.mockReturnValue(query);
    await expect(service.syncFromXtream('user-1', 'playlist-1')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
