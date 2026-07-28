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
});
