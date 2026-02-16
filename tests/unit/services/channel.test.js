const { AppError } = require('../../../src/utils/AppError');

// --- Mock the database module ---
const mockKnex = jest.fn();
// Mock transaction support
mockKnex.transaction = jest.fn();
mockKnex.fn = { now: jest.fn().mockReturnValue('NOW()') };

jest.mock('../../../src/config/database', () => mockKnex);

const channelService = require('../../../src/services/ChannelService');

// Helper to build chainable query mock
function chainable(overrides = {}) {
  const chain = {
    join: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    whereRaw: jest.fn().mockReturnThis(),
    orWhereRaw: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    orderByRaw: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    clone: jest.fn(),
    first: jest.fn().mockResolvedValue(undefined),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
    returning: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
  // clone returns a new chainable with same defaults
  chain.clone.mockReturnValue(chain);
  return chain;
}

describe('ChannelService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should return channels with pagination structure', async () => {
      const fakeChannels = [
        { id: 'ch-1', name: 'Channel 1', sort_order: 0 },
        { id: 'ch-2', name: 'Channel 2', sort_order: 1 },
      ];

      // Mock playlist ownership check
      const playlistChain = chainable({
        first: jest.fn().mockResolvedValue({ id: 'pl-1', user_id: 'user-1' }),
      });

      // Mock channels query - needs to support clone for count and data queries
      const countResult = { count: '2' };
      const dataChain = chainable({
        first: jest.fn().mockResolvedValue(countResult),
      });

      // Track clone calls to return different results
      let cloneCallCount = 0;
      dataChain.clone.mockImplementation(() => {
        cloneCallCount++;
        if (cloneCallCount === 1) {
          // count query
          return chainable({ first: jest.fn().mockResolvedValue(countResult) });
        }
        // data query - resolves to array (thenable)
        const resultChain = chainable();
        resultChain.offset = jest.fn().mockResolvedValue(fakeChannels);
        return resultChain;
      });

      mockKnex.mockImplementation((table) => {
        if (table === 'playlists') return playlistChain;
        if (table === 'channels') return dataChain;
        return chainable();
      });

      const result = await channelService.list('user-1', 'pl-1', { page: 1, limit: 100 });

      expect(result).toHaveProperty('channels');
      expect(result).toHaveProperty('total');
      expect(result.total).toBe(2);
      expect(result.channels).toEqual(fakeChannels);
    });

    it('should apply search parameter when provided', async () => {
      const playlistChain = chainable({
        first: jest.fn().mockResolvedValue({ id: 'pl-1', user_id: 'user-1' }),
      });

      const dataChain = chainable();
      let andWhereCallbackCalled = false;

      dataChain.andWhere.mockImplementation(function (arg) {
        if (typeof arg === 'function') {
          andWhereCallbackCalled = true;
        }
        return dataChain;
      });

      dataChain.clone.mockImplementation(() => {
        const c = chainable({ first: jest.fn().mockResolvedValue({ count: '0' }) });
        c.andWhere = dataChain.andWhere;
        c.offset = jest.fn().mockResolvedValue([]);
        return c;
      });

      mockKnex.mockImplementation((table) => {
        if (table === 'playlists') return playlistChain;
        if (table === 'channels') return dataChain;
        return chainable();
      });

      await channelService.list('user-1', 'pl-1', { search: 'sport' });

      // andWhere should have been called with a callback for the search condition
      expect(andWhereCallbackCalled).toBe(true);
    });

    it('should apply category filter when provided', async () => {
      const playlistChain = chainable({
        first: jest.fn().mockResolvedValue({ id: 'pl-1', user_id: 'user-1' }),
      });

      const dataChain = chainable();
      const andWhereCalls = [];
      dataChain.andWhere.mockImplementation(function (...args) {
        andWhereCalls.push(args);
        return dataChain;
      });

      dataChain.clone.mockImplementation(() => {
        const c = chainable({ first: jest.fn().mockResolvedValue({ count: '0' }) });
        c.offset = jest.fn().mockResolvedValue([]);
        return c;
      });

      mockKnex.mockImplementation((table) => {
        if (table === 'playlists') return playlistChain;
        if (table === 'channels') return dataChain;
        return chainable();
      });

      await channelService.list('user-1', 'pl-1', { categoryId: 'cat-1' });

      // Should have called andWhere with category_id
      const categoryCall = andWhereCalls.find(
        (args) => args[0] === 'channels.category_id' && args[1] === 'cat-1'
      );
      expect(categoryCall).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update channel fields and return updated channel', async () => {
      const existingChannel = {
        id: 'ch-1', name: 'Old Name', logo_url: 'old.png',
        playlist_id: 'pl-1', sort_order: 0,
      };
      const updatedChannel = {
        ...existingChannel, name: 'New Name', logo_url: 'new.png',
      };

      // First call: ownership check (channels join playlists)
      const ownershipChain = chainable({
        first: jest.fn().mockResolvedValue(existingChannel),
      });

      // Second call: update
      const updateChain = chainable({
        update: jest.fn().mockResolvedValue(1),
      });

      // Third call: fetch updated
      const fetchChain = chainable({
        first: jest.fn().mockResolvedValue(updatedChannel),
      });

      let callCount = 0;
      mockKnex.mockImplementation((table) => {
        if (table === 'channels') {
          callCount++;
          if (callCount === 1) return ownershipChain;
          if (callCount === 2) return updateChain;
          return fetchChain;
        }
        return chainable();
      });

      const result = await channelService.update('user-1', 'ch-1', {
        name: 'New Name',
        logo_url: 'new.png',
      });

      expect(result.name).toBe('New Name');
      expect(result.logo_url).toBe('new.png');
    });

    it('should throw NOT_FOUND for non-existent channel', async () => {
      const ownershipChain = chainable({
        first: jest.fn().mockResolvedValue(undefined),
      });

      mockKnex.mockImplementation(() => ownershipChain);

      await expect(
        channelService.update('user-1', 'nonexistent', { name: 'Test' })
      ).rejects.toThrow(AppError);

      try {
        await channelService.update('user-1', 'nonexistent', { name: 'Test' });
      } catch (err) {
        expect(err.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('updateOrder', () => {
    it('should move channel to new position correctly', async () => {
      const channel = { id: 'ch-2', playlist_id: 'pl-1', sort_order: 1 };

      // Ownership check
      const ownershipChain = chainable({
        first: jest.fn().mockResolvedValue(channel),
      });

      mockKnex.mockImplementation(() => ownershipChain);

      const allChannels = [
        { id: 'ch-1', sort_order: 0 },
        { id: 'ch-2', sort_order: 1 },
        { id: 'ch-3', sort_order: 2 },
      ];

      const updateCalls = [];
      const trxMock = jest.fn((table) => {
        const c = chainable();
        c.orderBy = jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(allChannels),
        });
        c.update = jest.fn().mockImplementation((data) => {
          updateCalls.push(data);
          return Promise.resolve(1);
        });
        return c;
      });

      mockKnex.transaction.mockImplementation(async (cb) => cb(trxMock));

      await channelService.updateOrder('user-1', 'ch-2', 0);

      // ch-2 should be moved to position 0
      // Expected order: ch-2(0), ch-1(1), ch-3(2)
      expect(updateCalls).toHaveLength(3);
      expect(updateCalls[0]).toEqual({ sort_order: 0 }); // ch-2
      expect(updateCalls[1]).toEqual({ sort_order: 1 }); // ch-1
      expect(updateCalls[2]).toEqual({ sort_order: 2 }); // ch-3
    });
  });

  describe('bulkUpdate', () => {
    it('should update multiple channels and return count', async () => {
      const ownedChannels = [{ id: 'ch-1' }, { id: 'ch-2' }];

      // Ownership verification
      const ownershipChain = chainable({
        select: jest.fn().mockResolvedValue(ownedChannels),
      });

      // Update query
      const updateChain = chainable({
        update: jest.fn().mockResolvedValue(2),
      });

      let callCount = 0;
      mockKnex.mockImplementation((table) => {
        if (table === 'channels') {
          callCount++;
          if (callCount === 1) return ownershipChain;
          return updateChain;
        }
        return chainable();
      });

      const result = await channelService.bulkUpdate(
        'user-1',
        ['ch-1', 'ch-2'],
        { name: 'Bulk Updated' }
      );

      expect(result).toEqual({ updated: 2 });
    });
  });

  describe('bulkMove', () => {
    it('should move channels to new category and return count', async () => {
      const ownedChannels = [{ id: 'ch-1' }, { id: 'ch-2' }];

      // Ownership verification for channels
      const channelOwnershipChain = chainable({
        select: jest.fn().mockResolvedValue(ownedChannels),
      });

      // Category ownership verification
      const categoryChain = chainable({
        first: jest.fn().mockResolvedValue({ id: 'cat-2', name: 'Target' }),
      });

      // Update query
      const updateChain = chainable({
        update: jest.fn().mockResolvedValue(2),
      });

      let channelCallCount = 0;
      mockKnex.mockImplementation((table) => {
        if (table === 'channels') {
          channelCallCount++;
          if (channelCallCount === 1) return channelOwnershipChain;
          return updateChain;
        }
        if (table === 'categories') return categoryChain;
        return chainable();
      });

      const result = await channelService.bulkMove('user-1', ['ch-1', 'ch-2'], 'cat-2');

      expect(result).toEqual({ moved: 2 });
    });
  });

  describe('delete', () => {
    it('should delete channel and recompact sort_order', async () => {
      const channel = { id: 'ch-2', playlist_id: 'pl-1', sort_order: 1 };

      // Ownership check
      const ownershipChain = chainable({
        first: jest.fn().mockResolvedValue(channel),
      });

      mockKnex.mockImplementation(() => ownershipChain);

      const remaining = [
        { id: 'ch-1' },
        { id: 'ch-3' },
      ];

      const updateCalls = [];
      const trxMock = jest.fn((table) => {
        const c = chainable();
        c.del = jest.fn().mockResolvedValue(1);
        c.orderBy = jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(remaining),
        });
        c.update = jest.fn().mockImplementation((data) => {
          updateCalls.push(data);
          return Promise.resolve(1);
        });
        return c;
      });

      mockKnex.transaction.mockImplementation(async (cb) => cb(trxMock));

      await channelService.delete('user-1', 'ch-2');

      // Remaining channels should be recompacted: ch-1(0), ch-3(1)
      expect(updateCalls).toHaveLength(2);
      expect(updateCalls[0]).toEqual({ sort_order: 0 });
      expect(updateCalls[1]).toEqual({ sort_order: 1 });
    });

    it('should throw NOT_FOUND for non-existent channel', async () => {
      const ownershipChain = chainable({
        first: jest.fn().mockResolvedValue(undefined),
      });

      mockKnex.mockImplementation(() => ownershipChain);

      await expect(
        channelService.delete('user-1', 'nonexistent')
      ).rejects.toThrow(AppError);

      try {
        await channelService.delete('user-1', 'nonexistent');
      } catch (err) {
        expect(err.code).toBe('NOT_FOUND');
      }
    });
  });
});
