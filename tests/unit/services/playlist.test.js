const mockDb = jest.fn();
mockDb.fn = { now: jest.fn(() => 'NOW') };
mockDb.raw = jest.fn((sql) => sql);
jest.mock('../../../src/config/database', () => mockDb);

const playlistService = require('../../../src/services/PlaylistService');

function builder({ rows = [], first, returning = [], updated = 1 } = {}) {
  const query = {};
  for (const method of ['select', 'count', 'groupBy', 'as', 'leftJoin', 'where', 'orderBy', 'insert']) query[method] = jest.fn(() => query);
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
});
