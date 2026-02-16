const { AppError } = require('../../../src/utils/AppError');

// --- Mock the database module ---
const mockKnex = jest.fn();
mockKnex.transaction = jest.fn();
mockKnex.fn = { now: jest.fn().mockReturnValue('NOW()') };

jest.mock('../../../src/config/database', () => mockKnex);

const categoryService = require('../../../src/services/CategoryService');

// Helper to build chainable query mock
function chainable(overrides = {}) {
  const chain = {
    join: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    max: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(undefined),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
    returning: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
  return chain;
}

describe('CategoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should return categories ordered by sort_order', async () => {
      const fakeCategories = [
        { id: 'cat-1', name: 'Spor', sort_order: 0 },
        { id: 'cat-2', name: 'Haber', sort_order: 1 },
        { id: 'cat-3', name: 'Film', sort_order: 2 },
      ];

      const playlistChain = chainable({
        first: jest.fn().mockResolvedValue({ id: 'pl-1', user_id: 'user-1' }),
      });

      // categories query returns array directly from orderBy
      const categoriesChain = chainable();
      categoriesChain.orderBy = jest.fn().mockResolvedValue(fakeCategories);

      mockKnex.mockImplementation((table) => {
        if (table === 'playlists') return playlistChain;
        if (table === 'categories') return categoriesChain;
        return chainable();
      });

      const result = await categoryService.list('user-1', 'pl-1');

      expect(result).toEqual(fakeCategories);
      expect(result[0].sort_order).toBeLessThan(result[1].sort_order);
      expect(result[1].sort_order).toBeLessThan(result[2].sort_order);
    });
  });

  describe('create', () => {
    it('should add category with correct sort_order (max + 1)', async () => {
      const newCategory = { id: 'cat-new', name: 'Müzik', sort_order: 3, playlist_id: 'pl-1' };

      const playlistChain = chainable({
        first: jest.fn().mockResolvedValue({ id: 'pl-1', user_id: 'user-1' }),
      });

      // max query
      const maxChain = chainable({
        first: jest.fn().mockResolvedValue({ max_order: 2 }),
      });

      // insert query
      const insertChain = chainable({
        returning: jest.fn().mockResolvedValue([newCategory]),
      });

      let categoryCallCount = 0;
      mockKnex.mockImplementation((table) => {
        if (table === 'playlists') return playlistChain;
        if (table === 'categories') {
          categoryCallCount++;
          if (categoryCallCount === 1) return maxChain;
          return insertChain;
        }
        return chainable();
      });

      const result = await categoryService.create('user-1', 'pl-1', 'Müzik');

      expect(result).toEqual(newCategory);
      expect(result.sort_order).toBe(3);
    });

    it('should set sort_order to 0 when no categories exist', async () => {
      const newCategory = { id: 'cat-first', name: 'İlk', sort_order: 0, playlist_id: 'pl-1' };

      const playlistChain = chainable({
        first: jest.fn().mockResolvedValue({ id: 'pl-1', user_id: 'user-1' }),
      });

      const maxChain = chainable({
        first: jest.fn().mockResolvedValue({ max_order: null }),
      });

      const insertChain = chainable({
        returning: jest.fn().mockResolvedValue([newCategory]),
      });

      let categoryCallCount = 0;
      mockKnex.mockImplementation((table) => {
        if (table === 'playlists') return playlistChain;
        if (table === 'categories') {
          categoryCallCount++;
          if (categoryCallCount === 1) return maxChain;
          return insertChain;
        }
        return chainable();
      });

      const result = await categoryService.create('user-1', 'pl-1', 'İlk');

      expect(result.sort_order).toBe(0);
    });
  });

  describe('update', () => {
    it('should change category name and return updated category', async () => {
      const existingCategory = { id: 'cat-1', name: 'Eski Ad', playlist_id: 'pl-1', sort_order: 0 };
      const updatedCategory = { ...existingCategory, name: 'Yeni Ad' };

      // Ownership check (categories join playlists)
      const ownershipChain = chainable({
        first: jest.fn().mockResolvedValue(existingCategory),
      });

      // Update query
      const updateChain = chainable({
        update: jest.fn().mockResolvedValue(1),
      });

      // Fetch updated
      const fetchChain = chainable({
        first: jest.fn().mockResolvedValue(updatedCategory),
      });

      let callCount = 0;
      mockKnex.mockImplementation((table) => {
        if (table === 'categories') {
          callCount++;
          if (callCount === 1) return ownershipChain;
          if (callCount === 2) return updateChain;
          return fetchChain;
        }
        return chainable();
      });

      const result = await categoryService.update('user-1', 'cat-1', 'Yeni Ad');

      expect(result.name).toBe('Yeni Ad');
    });

    it('should throw NOT_FOUND for non-existent category', async () => {
      const ownershipChain = chainable({
        first: jest.fn().mockResolvedValue(undefined),
      });

      mockKnex.mockImplementation(() => ownershipChain);

      await expect(
        categoryService.update('user-1', 'nonexistent', 'Test')
      ).rejects.toThrow(AppError);

      try {
        await categoryService.update('user-1', 'nonexistent', 'Test');
      } catch (err) {
        expect(err.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('updateOrder', () => {
    it('should move category to new position correctly', async () => {
      const category = { id: 'cat-2', playlist_id: 'pl-1', sort_order: 1 };

      // Ownership check
      const ownershipChain = chainable({
        first: jest.fn().mockResolvedValue(category),
      });

      mockKnex.mockImplementation(() => ownershipChain);

      const allCategories = [
        { id: 'cat-1', sort_order: 0 },
        { id: 'cat-2', sort_order: 1 },
        { id: 'cat-3', sort_order: 2 },
      ];

      const updateCalls = [];
      const trxMock = jest.fn((table) => {
        const c = chainable();
        c.orderBy = jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(allCategories),
        });
        c.update = jest.fn().mockImplementation((data) => {
          updateCalls.push(data);
          return Promise.resolve(1);
        });
        return c;
      });

      mockKnex.transaction.mockImplementation(async (cb) => cb(trxMock));

      await categoryService.updateOrder('user-1', 'cat-2', 0);

      // cat-2 moved to position 0
      // Expected order: cat-2(0), cat-1(1), cat-3(2)
      expect(updateCalls).toHaveLength(3);
      expect(updateCalls[0]).toEqual({ sort_order: 0 }); // cat-2
      expect(updateCalls[1]).toEqual({ sort_order: 1 }); // cat-1
      expect(updateCalls[2]).toEqual({ sort_order: 2 }); // cat-3
    });
  });

  describe('delete', () => {
    it('should move channels to null category and remove category', async () => {
      const category = { id: 'cat-1', playlist_id: 'pl-1', sort_order: 0 };

      // Ownership check
      const ownershipChain = chainable({
        first: jest.fn().mockResolvedValue(category),
      });

      mockKnex.mockImplementation(() => ownershipChain);

      const remaining = [{ id: 'cat-2' }, { id: 'cat-3' }];

      const trxOperations = [];
      const trxFn = { now: jest.fn().mockReturnValue('NOW()') };
      const trxMock = jest.fn((table) => {
        const c = chainable();
        c.update = jest.fn().mockImplementation((data) => {
          trxOperations.push({ table, op: 'update', data });
          return Promise.resolve(1);
        });
        c.del = jest.fn().mockImplementation(() => {
          trxOperations.push({ table, op: 'del' });
          return Promise.resolve(1);
        });
        c.orderBy = jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(remaining),
        });
        return c;
      });
      trxMock.fn = trxFn;

      mockKnex.transaction.mockImplementation(async (cb) => cb(trxMock));

      await categoryService.delete('user-1', 'cat-1');

      // First: channels updated to null category
      const channelUpdate = trxOperations.find(
        (op) => op.table === 'channels' && op.op === 'update'
      );
      expect(channelUpdate).toBeDefined();
      expect(channelUpdate.data.category_id).toBeNull();

      // Second: category deleted
      const categoryDelete = trxOperations.find(
        (op) => op.table === 'categories' && op.op === 'del'
      );
      expect(categoryDelete).toBeDefined();

      // Third: remaining categories recompacted
      const recompactUpdates = trxOperations.filter(
        (op) => op.table === 'categories' && op.op === 'update'
      );
      expect(recompactUpdates).toHaveLength(2);
      expect(recompactUpdates[0].data).toEqual({ sort_order: 0 });
      expect(recompactUpdates[1].data).toEqual({ sort_order: 1 });
    });

    it('should throw NOT_FOUND for non-existent category', async () => {
      const ownershipChain = chainable({
        first: jest.fn().mockResolvedValue(undefined),
      });

      mockKnex.mockImplementation(() => ownershipChain);

      await expect(
        categoryService.delete('user-1', 'nonexistent')
      ).rejects.toThrow(AppError);

      try {
        await categoryService.delete('user-1', 'nonexistent');
      } catch (err) {
        expect(err.code).toBe('NOT_FOUND');
      }
    });
  });
});
