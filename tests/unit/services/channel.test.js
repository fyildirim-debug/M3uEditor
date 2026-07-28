const mockDb = jest.fn();
mockDb.fn = { now: jest.fn(() => 'NOW') };
mockDb.transaction = jest.fn();
jest.mock('../../../src/config/database', () => mockDb);

const channelService = require('../../../src/services/ChannelService');

function builder({ rows = [], first, updated = 1 } = {}) {
  const query = {};
  for (const method of ['join', 'where', 'whereIn', 'andWhere', 'select', 'clone', 'count', 'leftJoin', 'orderBy', 'limit', 'offset', 'update', 'max']) query[method] = jest.fn(() => query);
  query.first = jest.fn().mockResolvedValue(first);
  query.del = jest.fn().mockResolvedValue(updated);
  query.then = (resolve, reject) => Promise.resolve(rows).then(resolve, reject);
  return query;
}

describe('ChannelService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns capped pagination metadata after ownership verification', async () => {
    const playlist = builder({ first: { id: 'p1', user_id: 'user-1' } });
    const channels = builder({ rows: [{ id: 'c1' }, { id: 'c2' }], first: { count: '2' } });
    mockDb.mockImplementation((table) => table === 'playlists' ? playlist : channels);

    await expect(channelService.list('user-1', 'p1', { page: 1, limit: 1 })).resolves.toEqual({
      channels: [{ id: 'c1' }, { id: 'c2' }], total: 2, totalPages: 2,
    });
    expect(playlist.where).toHaveBeenCalledWith({ id: 'p1', user_id: 'user-1' });
    expect(channels.limit).toHaveBeenCalledWith(1);
  });

  test('never allows direct EPG ownership fields through generic channel updates', async () => {
    const owned = builder({ first: { id: 'c1', playlist_id: 'p1', name: 'Old' } });
    mockDb.mockReturnValue(owned);
    await channelService.update('user-1', 'c1', { name: 'New', epg_channel_id: 'foreign', epg_source_id: 'foreign-source' });
    const updatePayload = owned.update.mock.calls[0][0];
    expect(updatePayload).toEqual(expect.objectContaining({ name: 'New' }));
    expect(updatePayload).not.toHaveProperty('epg_channel_id');
    expect(updatePayload).not.toHaveProperty('epg_source_id');
  });

  test('rejects bulk moves across playlist boundaries', async () => {
    const channels = builder({ rows: [{ id: 'c1', playlist_id: 'p1' }] });
    const category = builder({ first: { id: 'cat2', playlist_id: 'p2' } });
    mockDb.mockImplementation((table) => table === 'categories' ? category : channels);
    await expect(channelService.bulkMove('user-1', ['c1'], 'cat2')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  test('rejects operations on channels outside the tenant', async () => {
    mockDb.mockReturnValue(builder({ first: undefined }));
    await expect(channelService.delete('user-1', 'foreign')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('rejects oversized channel field values before touching the database', async () => {
    mockDb.mockReturnValue(builder({ first: { id: 'c1', playlist_id: 'p1', name: 'Old' } }));
    await expect(channelService.update('user-1', 'c1', { name: 'x'.repeat(501) }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(channelService.update('user-1', 'c1', { logo_url: 'x'.repeat(5001) }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mockDb).not.toHaveBeenCalled();
  });

  test('rejects oversized values in bulk updates before touching the database', async () => {
    await expect(channelService.bulkUpdate('user-1', ['c1'], { name: 'x'.repeat(501) }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mockDb).not.toHaveBeenCalled();
  });

  test('rejects control characters that would inject extra M3U lines', async () => {
    mockDb.mockReturnValue(builder({ first: { id: 'c1', playlist_id: 'p1', name: 'Old' } }));
    await expect(channelService.update('user-1', 'c1', { name: 'Evil\n#EXTINF:-1,Injected' }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  test('rejects bulk rename terms and projected names beyond the field limit', async () => {
    await expect(channelService.bulkRename('user-1', ['c1'], 'a', 'x'.repeat(1001)))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(channelService.bulkRename('user-1', ['c1'], ''))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    // Girdiler sinir icinde ama uretilen ad sinirin ustunde kaliyor.
    const owned = builder({ rows: [{ id: 'c1', name: 'a'.repeat(400) }] });
    mockDb.mockReturnValue(owned);
    mockDb.transaction.mockImplementation((callback) => callback(owned));
    await expect(channelService.bulkRename('user-1', ['c1'], 'a', 'bb'))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  test('compacts sort order with a single set-based statement', async () => {
    const owned = builder({ first: { id: 'c1', playlist_id: 'p1' } });
    const raw = jest.fn().mockResolvedValue({ rowCount: 0 });
    mockDb.mockReturnValue(owned);
    const trx = Object.assign(jest.fn(() => owned), { raw });
    mockDb.transaction.mockImplementation((callback) => callback(trx));

    await channelService.delete('user-1', 'c1');

    expect(raw).toHaveBeenCalledTimes(1);
    expect(raw.mock.calls[0][0]).toContain('ROW_NUMBER() OVER');
    expect(raw.mock.calls[0][1]).toEqual(['p1']);
  });
});
