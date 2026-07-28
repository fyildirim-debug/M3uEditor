const mockDb = jest.fn();
mockDb.fn = { now: jest.fn(() => 'NOW') };
mockDb.transaction = jest.fn();
mockDb.raw = jest.fn();
jest.mock('../../../src/config/database', () => mockDb);
const mockRemoveChannelLogos = jest.fn().mockResolvedValue();
jest.mock('../../../src/utils/logoStorage', () => ({ removeChannelLogos: mockRemoveChannelLogos }));

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

  test('removes a local logo after it is replaced by an external URL', async () => {
    const owned = builder({ first: { id: 'c1', playlist_id: 'p1', logo_url: '/logos/c1.png' } });
    mockDb.mockReturnValue(owned);

    await channelService.update('user-1', 'c1', { logo_url: 'https://cdn.example/logo.png' });

    expect(owned.update).toHaveBeenCalled();
    expect(mockRemoveChannelLogos).toHaveBeenCalledWith(['c1']);
    expect(owned.update.mock.invocationCallOrder[0]).toBeLessThan(mockRemoveChannelLogos.mock.invocationCallOrder[0]);
  });

  test('does not remove a newly uploaded local logo when its extension changes', async () => {
    const owned = builder({ first: { id: 'c1', playlist_id: 'p1', logo_url: '/logos/c1.png' } });
    mockDb.mockReturnValue(owned);

    await channelService.update('user-1', 'c1', { logo_url: '/logos/c1.webp' });

    expect(mockRemoveChannelLogos).not.toHaveBeenCalled();
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
    expect(mockRemoveChannelLogos).toHaveBeenCalledWith(['c1']);
  });

  test('does not remove channel logos when the delete transaction rolls back', async () => {
    const owned = builder({ first: { id: 'c1', playlist_id: 'p1' } });
    mockDb.mockReturnValue(owned);
    mockDb.transaction.mockRejectedValueOnce(new Error('rollback'));

    await expect(channelService.delete('user-1', 'c1')).rejects.toThrow('rollback');

    expect(mockRemoveChannelLogos).not.toHaveBeenCalled();
  });

  test('bulk updates remove only local logos replaced by an external URL', async () => {
    const channels = builder({ rows: [
      { id: 'c1', playlist_id: 'p1', logo_url: '/logos/c1.png' },
      { id: 'c2', playlist_id: 'p1', logo_url: 'https://cdn.example/old.png' },
    ] });
    channels.update.mockResolvedValue(2);
    mockDb.mockReturnValue(channels);

    await expect(channelService.bulkUpdate('user-1', ['c1', 'c2'], { logo_url: 'https://cdn.example/new.png' }))
      .resolves.toEqual({ updated: 2 });

    expect(mockRemoveChannelLogos).toHaveBeenCalledWith(['c1']);
  });

  describe('relative channel ordering', () => {
    test('rejects missing, conflicting, and malformed relative positions', async () => {
      await expect(channelService.updateOrder('user-1', 'c1', null))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      await expect(channelService.updateOrder('user-1', 'c1', {}))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      await expect(channelService.updateOrder('user-1', 'c1', { afterChannelId: 'c2', beforeChannelId: 'c3' }))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      await expect(channelService.updateOrder('user-1', 'c1', { afterChannelId: '' }))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(mockDb).not.toHaveBeenCalled();
    });

    test('rejects a reference channel from another playlist', async () => {
      mockDb
        .mockReturnValueOnce(builder({ first: { id: 'c1', playlist_id: 'p1' } }))
        .mockReturnValueOnce(builder({ first: { id: 'c2', playlist_id: 'p2' } }));

      await expect(channelService.updateOrder('user-1', 'c1', { afterChannelId: 'c2' }))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(mockDb.raw).not.toHaveBeenCalled();
    });

    test('rejects self-references', async () => {
      mockDb.mockReturnValueOnce(builder({ first: { id: 'c1', playlist_id: 'p1' } }));

      await expect(channelService.updateOrder('user-1', 'c1', { beforeChannelId: 'c1' }))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(mockDb).toHaveBeenCalledTimes(1);
      expect(mockDb.raw).not.toHaveBeenCalled();
    });

    test('rejects a reference channel outside the authenticated tenant', async () => {
      mockDb
        .mockReturnValueOnce(builder({ first: { id: 'c1', playlist_id: 'p1' } }))
        .mockReturnValueOnce(builder({ first: undefined }));

      await expect(channelService.updateOrder('user-1', 'c1', { afterChannelId: 'foreign' }))
        .rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(mockDb.raw).not.toHaveBeenCalled();
    });

    test('updates relative order with one deterministic set-based statement', async () => {
      mockDb
        .mockReturnValueOnce(builder({ first: { id: 'c1', playlist_id: 'p1' } }))
        .mockReturnValueOnce(builder({ first: { id: 'c2', playlist_id: 'p1' } }));
      mockDb.raw.mockResolvedValueOnce({ rowCount: 2 });

      await channelService.updateOrder('user-1', 'c1', { afterChannelId: 'c2' });

      expect(mockDb.raw).toHaveBeenCalledTimes(1);
      const [sql, bindings] = mockDb.raw.mock.calls[0];
      expect(sql).toContain('ROW_NUMBER() OVER (ORDER BY sort_order ASC, id ASC)');
      expect(sql).toContain('IS DISTINCT FROM');
      expect(bindings).toEqual({
        playlistId: 'p1',
        channelId: 'c1',
        referenceChannelId: 'c2',
        placement: 'after',
      });
    });
  });
});
