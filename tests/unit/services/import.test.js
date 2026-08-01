const mockDb = jest.fn();
mockDb.fn = { now: jest.fn(() => 'NOW') };
mockDb.transaction = jest.fn();
jest.mock('../../../src/config/database', () => mockDb);

// Bu suite filtre kurallarini test etmez; applyForPlaylist no-op mock'lanir.
jest.mock('../../../src/services/FilterRuleService', () => jest.fn().mockImplementation(() => ({
  applyForPlaylist: jest.fn(async (_playlistId, records) => ({ records, filteredOut: 0 })),
})));

const ImportService = require('../../../src/services/ImportService');
const { decrypt } = require('../../../src/utils/crypto');

function transactionFixture(existingChannels = []) {
  const captures = { updates: [], deletes: 0, whereIns: [], deletedKeys: [] };
  const trx = jest.fn((table) => {
    const query = {};
    const exactFilters = {};
    const inFilters = [];
    query.where = jest.fn((column, value) => {
      if (typeof column === 'object') Object.assign(exactFilters, column);
      else exactFilters[column] = value;
      return query;
    });
    query.whereIn = jest.fn((column, values) => {
      captures.whereIns.push({ table, column, values });
      inFilters.push({ column, values });
      if (Array.isArray(column)) captures.deletedKeys.push(...values);
      return query;
    });
    query.whereNotNull = jest.fn(() => query);
    query.select = jest.fn().mockImplementation(async () => {
      if (table !== 'channels') return [];
      return existingChannels.filter((channel) => {
        if (Object.entries(exactFilters).some(([key, value]) => channel[key] !== undefined && channel[key] !== value)) return false;
        return inFilters.every(({ column, values }) => (
          Array.isArray(column) || values.includes(channel[column])
        ));
      });
    });
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
    expect(JSON.parse(record.extras)).toEqual(expect.objectContaining({
      stream_id: 42, stream_type: 'live', container_extension: 'ts', metadata_fetched: false,
    }));
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
    jest.spyOn(service, '_upsertCategories').mockResolvedValue({ map: { 'remote-1': 'category-1' }, addedNames: [] });
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
    jest.spyOn(service, '_upsertCategories').mockResolvedValue({ map: {}, addedNames: [] });
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
    jest.spyOn(service, '_upsertCategories').mockResolvedValue({ map: {}, addedNames: [] });
    jest.spyOn(service, '_bulkUpsertChannels').mockResolvedValue();
    const { trx, captures } = transactionFixture([{ source_id: '1', stream_type: 'live' }]);
    mockDb.transaction.mockImplementation((callback) => callback(trx));

    const result = await service.importFromXtream('user-1', { username: 'u', password: 'p' });
    expect(result.removed).toBe(0);
    expect(captures.deletes).toBe(0);
  });

  test('leaves a transiently failed content type completely untouched', async () => {
    // live basarili, vod gecici olarak basarisiz: vod kayitlari bayat sayilmamali.
    jest.spyOn(service, '_fetchXtream').mockResolvedValue({
      categories: [],
      channels: [{ stream_id: 1, name: 'Live A', stream_type: 'live', container_extension: 'ts' }],
      client,
      streamTypes: ['live', 'vod'],
      types: [
        { type: 'live', status: 'complete', error: null },
        { type: 'vod', status: 'failed', error: 'provider 502' },
      ],
    });
    jest.spyOn(service, '_getOrCreatePlaylist').mockResolvedValue({ id: 'playlist-1' });
    jest.spyOn(service, '_upsertCategories').mockResolvedValue({ map: {}, addedNames: [] });
    jest.spyOn(service, '_bulkUpsertChannels').mockResolvedValue();
    const { trx, captures } = transactionFixture([
      { source_id: '1', stream_type: 'live' },
      { source_id: '900', stream_type: 'vod' },
      { source_id: '901', stream_type: 'vod' },
    ]);
    mockDb.transaction.mockImplementation((callback) => callback(trx));

    const result = await service.importFromXtream('user-1', { username: 'u', password: 'p' });

    expect(result.syncedTypes).toEqual(['live']);
    expect(result.failedTypes).toEqual(['vod']);
    expect(result.partial).toBe(true);
    expect(result.removed).toBe(0);
    expect(captures.deletes).toBe(0);
    // Kismi senkronizasyon last_synced_at'i ilerletmemeli.
    expect(captures.updates.some((item) => item.payload.last_synced_at)).toBe(false);
  });

  test('reconciles only selected categories and leaves other and uncategorized channels untouched', async () => {
    jest.spyOn(service, '_fetchXtream').mockResolvedValue({
      categories: [{ category_id: '1', category_name: 'Category A' }],
      channels: [{ stream_id: 2, name: 'A Current', stream_type: 'live', container_extension: 'ts', category_id: '1' }],
      client,
      streamTypes: ['live'],
      scopedCategories: { live: ['1'] },
      types: [{ type: 'live', status: 'complete', error: null }],
    });
    jest.spyOn(service, '_getOrCreatePlaylist').mockResolvedValue({ id: 'playlist-1' });
    jest.spyOn(service, '_upsertCategories').mockResolvedValue({ map: { 1: 'category-a' }, addedNames: [] });
    jest.spyOn(service, '_bulkUpsertChannels').mockResolvedValue();
    const { trx, captures } = transactionFixture([
      { source_id: '1', stream_type: 'live', category_id: 'category-a' },
      { source_id: '2', stream_type: 'live', category_id: 'category-a' },
      { source_id: '3', stream_type: 'live', category_id: 'category-b' },
      { source_id: '4', stream_type: 'live', category_id: null },
    ]);
    mockDb.transaction.mockImplementation((callback) => callback(trx));

    const result = await service.importFromXtream('user-1', {
      username: 'u', password: 'p', categories: { live: ['1'] },
    });

    expect(result).toEqual(expect.objectContaining({
      added: 0,
      updated: 1,
      removed: 1,
      scopedCategories: { live: ['1'] },
    }));
    expect(captures.whereIns).toContainEqual({ table: 'channels', column: 'category_id', values: ['category-a'] });
    expect(captures.deletedKeys).toEqual([['live', '1']]);
    expect(captures.deletedKeys).not.toContainEqual(['live', '3']);
    expect(captures.deletedKeys).not.toContainEqual(['live', '4']);
  });

  test('applies partial removals but refuses to wipe an entire content type', async () => {
    jest.spyOn(service, '_fetchXtream').mockResolvedValue({
      categories: [],
      channels: [{ stream_id: 1, name: 'Live A', stream_type: 'live', container_extension: 'ts' }],
      client,
      streamTypes: ['live', 'vod'],
      types: [
        { type: 'live', status: 'complete', error: null },
        { type: 'vod', status: 'complete', error: null },
      ],
    });
    jest.spyOn(service, '_getOrCreatePlaylist').mockResolvedValue({ id: 'playlist-1' });
    jest.spyOn(service, '_upsertCategories').mockResolvedValue({ map: {}, addedNames: [] });
    jest.spyOn(service, '_bulkUpsertChannels').mockResolvedValue();
    const { trx, captures } = transactionFixture([
      { source_id: '1', stream_type: 'live' },
      { source_id: '2', stream_type: 'live' }, // artik yok -> silinmeli (kismi)
      { source_id: '900', stream_type: 'vod' }, // vod'un tamami kaybolmus -> korunmali
    ]);
    mockDb.transaction.mockImplementation((callback) => callback(trx));

    const result = await service.importFromXtream('user-1', { username: 'u', password: 'p' });

    expect(result.skippedRemovalTypes).toEqual(['vod']);
    expect(result.removed).toBe(1);
    expect(captures.deletes).toBe(1);
    expect(captures.updates.some((item) => item.payload.last_synced_at)).toBe(true);
  });

  test('plans stale removals per type without cross-type contamination', () => {
    const existing = [
      { source_id: '1', stream_type: 'live' },
      { source_id: '2', stream_type: 'live' },
      { source_id: '900', stream_type: 'vod' },
    ];
    const fetched = new Set(['live:1']);

    // vod tamamlanmadi -> hic degerlendirilmemeli
    expect(service._planStaleRemovals(existing, fetched, ['live'])).toEqual({
      stale: [{ source_id: '2', stream_type: 'live' }],
      skippedTypes: [],
    });
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

    const { map: categoryMap, addedNames } = await service._upsertCategories('playlist-1', categories, connection);

    expect(select).toHaveBeenCalledTimes(1);
    expect(insertedBatches.map((batch) => batch.length)).toEqual([1000, 1000, 500]);
    expect(categoryMap['0']).toBe('existing-id');
    expect(categoryMap['2500']).toBeTruthy();
    expect(addedNames).toHaveLength(2500);
    expect(addedNames).not.toContain('Category 0');
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

  test.each([
    ['Xtream source identity', 'source-42'],
    ['M3U stream URL identity', null],
  ])('preserves application metadata while refreshing provider extras for %s', async (_label, sourceId) => {
    const rawQueries = [];
    const connection = jest.fn(() => ({
      insert: jest.fn(() => ({
        toSQL: () => ({ sql: 'insert into channels', bindings: [] }),
      })),
    }));
    connection.raw = jest.fn(async (sql) => { rawQueries.push(sql); });
    const incomingExtras = {
      stream_id: 42,
      stream_type: 'vod',
      genre: 'Fresh provider genre',
      container_extension: 'mkv',
      metadata_fetched: false,
    };

    await service._bulkUpsertChannels('playlist-1', [{
      id: 'channel-1',
      playlist_id: 'playlist-1',
      source_id: sourceId,
      stream_type: 'vod',
      stream_url: 'https://stream/42',
      extras: JSON.stringify(incomingExtras),
    }], null, connection);

    const sql = rawQueries[0];
    expect(sql).toContain("extras = COALESCE(EXCLUDED.extras, '{}'::jsonb)");
    expect(sql).toContain("|| (COALESCE(channels.extras, '{}'::jsonb) - ARRAY[");
    const providerKeys = new Set(sql.match(/ARRAY\[([\s\S]*?)\]::text\[\]/)[1]
      .match(/'[^']+'/g)
      .map((key) => key.slice(1, -1)));
    const existingExtras = {
      stream_id: 42,
      stream_type: 'vod',
      genre: 'Old provider genre',
      metadata_fetched: true,
      poster_url: 'https://images/poster.jpg',
      cast: 'Actor One, Actor Two',
      future_application_field: 'keep me',
    };
    // Mirrors PostgreSQL's EXCLUDED || (channels.extras - provider_keys) expression.
    const preservedApplicationExtras = Object.fromEntries(
      Object.entries(existingExtras).filter(([key]) => !providerKeys.has(key))
    );
    const mergedExtras = { ...incomingExtras, ...preservedApplicationExtras };

    expect(mergedExtras).toEqual(expect.objectContaining({
      genre: 'Fresh provider genre',
      metadata_fetched: true,
      poster_url: 'https://images/poster.jpg',
      cast: 'Actor One, Actor Two',
      future_application_field: 'keep me',
    }));
    expect(providerKeys).toEqual(new Set([
      'stream_id', 'stream_type', 'rating', 'genre', 'plot', 'year', 'tmdb_id', 'container_extension',
    ]));
  });

  test('sync rejects playlists with no saved provider credentials', async () => {
    const query = { where: jest.fn().mockReturnThis(), first: jest.fn().mockResolvedValue({ id: 'playlist-1' }) };
    mockDb.mockReturnValue(query);
    await expect(service.syncFromXtream('user-1', 'playlist-1')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
