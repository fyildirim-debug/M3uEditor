const mockDb = jest.fn();
mockDb.fn = { now: jest.fn(() => 'NOW') };
mockDb.raw = jest.fn((sql) => sql);
mockDb.transaction = jest.fn();
jest.mock('../../../src/config/database', () => mockDb);
const mockRemoveChannelLogos = jest.fn().mockResolvedValue();
jest.mock('../../../src/utils/logoStorage', () => ({ removeChannelLogos: mockRemoveChannelLogos }));

const playlistService = require('../../../src/services/PlaylistService');

function builder({ rows = [], first, returning = [], updated = 1 } = {}) {
  const query = {};
  for (const method of ['select', 'count', 'groupBy', 'as', 'leftJoin', 'joinRaw', 'where', 'orderBy', 'insert']) query[method] = jest.fn(() => query);
  query.first = jest.fn().mockResolvedValue(first);
  query.returning = jest.fn().mockResolvedValue(returning);
  query.update = jest.fn().mockResolvedValue(updated);
  query.del = jest.fn().mockResolvedValue(updated);
  query.then = (resolve, reject) => Promise.resolve(rows).then(resolve, reject);
  return query;
}

describe('PlaylistService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('lists tenant playlists using a projection that excludes credentials and share secrets', async () => {
    const channelCounts = builder();
    const playlists = builder({ rows: [{ id: 'p1', name: 'News', channel_count: 2, has_xtream_source: true }] });
    mockDb.mockImplementation((table) => table === 'channels' ? channelCounts : playlists);

    await expect(playlistService.list('user-1')).resolves.toEqual([expect.objectContaining({ id: 'p1' })]);
    const selectedFields = playlists.select.mock.calls.flat();
    expect(selectedFields).not.toContain('playlists.xtream_password_enc');
    expect(selectedFields).not.toContain('playlists.share_token');
    expect(playlists.where).toHaveBeenCalledWith('playlists.user_id', 'user-1');

    // Kanal sayimi istegi yapan kullanicinin playlist'lerine bagli olmali;
    // tum kullanicilari kapsayan bir GROUP BY'a geri donulmemeli.
    const joinSql = playlists.joinRaw.mock.calls.flat().join(' ');
    expect(joinSql).toContain('LEFT JOIN LATERAL');
    expect(joinSql).toContain('channels.playlist_id = playlists.id');
    expect(playlists.groupBy).not.toHaveBeenCalled();
  });

  test('creates a playlist with server-generated ownership', async () => {
    const playlists = builder({ returning: [{ id: 'p1', user_id: 'user-1', name: 'My list' }] });
    mockDb.mockReturnValue(playlists);
    await expect(playlistService.create('user-1', { name: 'My list' })).resolves.toEqual(expect.objectContaining({ user_id: 'user-1' }));
    expect(playlists.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-1', name: 'My list' }));
  });

  test('updates only an owned playlist', async () => {
    const playlists = builder();
    playlists.first
      .mockResolvedValueOnce({ id: 'p1', user_id: 'user-1' })
      .mockResolvedValueOnce({ id: 'p1', user_id: 'user-1', name: 'Renamed' });
    mockDb.mockReturnValue(playlists);
    await expect(playlistService.update('user-1', 'p1', { name: 'Renamed' })).resolves.toEqual(expect.objectContaining({ name: 'Renamed' }));
  });

  test('does not reveal whether another user owns a playlist', async () => {
    mockDb.mockReturnValue(builder({ first: undefined }));
    await expect(playlistService.delete('user-1', 'foreign')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('removes playlist channel logos only after the delete transaction commits', async () => {
    const playlist = builder({ first: { id: 'p1', user_id: 'user-1' } });
    mockDb.mockReturnValue(playlist);
    const channels = builder({ rows: [{ id: 'c1' }, { id: 'c2' }] });
    const deletedPlaylist = builder();
    const events = [];
    const trx = jest.fn((table) => table === 'channels' ? channels : deletedPlaylist);
    mockDb.transaction.mockImplementation(async (callback) => {
      const result = await callback(trx);
      events.push('commit');
      return result;
    });
    mockRemoveChannelLogos.mockImplementationOnce(async (ids) => events.push(`remove:${ids.join(',')}`));

    await playlistService.delete('user-1', 'p1');

    expect(events).toEqual(['commit', 'remove:c1,c2']);
    expect(deletedPlaylist.del).toHaveBeenCalled();
  });

  test('keeps playlist logos when the delete transaction rolls back', async () => {
    mockDb.mockReturnValue(builder({ first: { id: 'p1', user_id: 'user-1' } }));
    mockDb.transaction.mockRejectedValueOnce(new Error('rollback'));

    await expect(playlistService.delete('user-1', 'p1')).rejects.toThrow('rollback');

    expect(mockRemoveChannelLogos).not.toHaveBeenCalled();
  });
});
