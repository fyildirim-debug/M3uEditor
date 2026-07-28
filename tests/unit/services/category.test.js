const mockDb = jest.fn();
mockDb.fn = { now: jest.fn(() => 'NOW') };
mockDb.raw = jest.fn((sql) => sql);
jest.mock('../../../src/config/database', () => mockDb);

const categoryService = require('../../../src/services/CategoryService');

function builder({ rows = [], first, returning = [] } = {}) {
  const query = {};
  for (const method of ['leftJoin', 'where', 'groupBy', 'orderBy', 'select', 'having', 'join', 'andWhere', 'max', 'insert', 'update', 'del']) query[method] = jest.fn(() => query);
  query.first = jest.fn().mockResolvedValue(first);
  query.returning = jest.fn().mockResolvedValue(returning);
  query.then = (resolve, reject) => Promise.resolve(rows).then(resolve, reject);
  return query;
}

describe('CategoryService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('verifies playlist ownership before listing categories with counts', async () => {
    const playlist = builder({ first: { id: 'p1', user_id: 'user-1' } });
    const categories = builder({ rows: [{ id: 'c1', name: 'News', channel_count: 3 }] });
    mockDb.mockImplementation((table) => table === 'playlists' ? playlist : categories);

    await expect(categoryService.list('user-1', 'p1')).resolves.toEqual([expect.objectContaining({ channel_count: 3 })]);
    expect(playlist.where).toHaveBeenCalledWith({ id: 'p1', user_id: 'user-1' });
    expect(categories.orderBy).toHaveBeenCalledWith('categories.sort_order', 'asc');
  });

  test('creates the next category position inside the owned playlist', async () => {
    const playlist = builder({ first: { id: 'p1' } });
    const categories = builder({ first: { max_order: 4 }, returning: [{ id: 'c2', sort_order: 5 }] });
    mockDb.mockImplementation((table) => table === 'playlists' ? playlist : categories);
    await expect(categoryService.create('user-1', 'p1', 'Sports')).resolves.toEqual(expect.objectContaining({ sort_order: 5 }));
    expect(categories.insert).toHaveBeenCalledWith(expect.objectContaining({ playlist_id: 'p1', sort_order: 5 }));
  });

  test('rejects categories outside the authenticated tenant', async () => {
    mockDb.mockReturnValue(builder({ first: undefined }));
    await expect(categoryService.update('user-1', 'foreign', 'Name')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  describe('relative category ordering', () => {
    test('rejects missing or conflicting relative positions', async () => {
      await expect(categoryService.updateOrder('user-1', 'c1', null))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      await expect(categoryService.updateOrder('user-1', 'c1', {}))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      await expect(categoryService.updateOrder('user-1', 'c1', { afterCategoryId: 'c2', beforeCategoryId: 'c3' }))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(mockDb).not.toHaveBeenCalled();
    });

    test('rejects cross-playlist and self references', async () => {
      mockDb
        .mockReturnValueOnce(builder({ first: { id: 'c1', playlist_id: 'p1' } }))
        .mockReturnValueOnce(builder({ first: { id: 'c2', playlist_id: 'p2' } }));
      await expect(categoryService.updateOrder('user-1', 'c1', { afterCategoryId: 'c2' }))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

      mockDb.mockReturnValueOnce(builder({ first: { id: 'c1', playlist_id: 'p1' } }));
      await expect(categoryService.updateOrder('user-1', 'c1', { beforeCategoryId: 'c1' }))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(mockDb.raw).not.toHaveBeenCalled();
    });

    test('rejects a reference category outside the authenticated tenant', async () => {
      mockDb
        .mockReturnValueOnce(builder({ first: { id: 'c1', playlist_id: 'p1' } }))
        .mockReturnValueOnce(builder({ first: undefined }));

      await expect(categoryService.updateOrder('user-1', 'c1', { afterCategoryId: 'foreign' }))
        .rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(mockDb.raw).not.toHaveBeenCalled();
    });

    test('updates relative order with one deterministic set-based statement', async () => {
      mockDb
        .mockReturnValueOnce(builder({ first: { id: 'c1', playlist_id: 'p1' } }))
        .mockReturnValueOnce(builder({ first: { id: 'c2', playlist_id: 'p1' } }));
      mockDb.raw.mockResolvedValueOnce({ rowCount: 2 });

      await categoryService.updateOrder('user-1', 'c1', { beforeCategoryId: 'c2' });

      expect(mockDb.raw).toHaveBeenCalledTimes(1);
      const [sql, bindings] = mockDb.raw.mock.calls[0];
      expect(sql).toContain('ROW_NUMBER() OVER (ORDER BY sort_order ASC, id ASC)');
      expect(sql).toContain('IS DISTINCT FROM');
      expect(bindings).toEqual({
        playlistId: 'p1',
        categoryId: 'c1',
        referenceCategoryId: 'c2',
        placement: 'before',
      });
    });
  });
});
