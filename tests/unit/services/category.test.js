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
});
