const { AppError } = require('../../../src/utils/AppError');

// --- Mock the database module ---
const mockKnex = jest.fn();
mockKnex.fn = { now: jest.fn().mockReturnValue('NOW()') };

jest.mock('../../../src/config/database', () => mockKnex);

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('generated-uuid'),
}));

const playlistService = require('../../../src/services/PlaylistService');

// Helper to build chainable query mock
function chainable(overrides = {}) {
  const chain = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(undefined),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
    returning: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
  return chain;
}

describe('PlaylistService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should return playlists ordered by created_at desc', async () => {
      const fakePlaylists = [
        { id: 'pl-2', user_id: 'user-1', name: 'Second', created_at: '2024-01-02' },
        { id: 'pl-1', user_id: 'user-1', name: 'First', created_at: '2024-01-01' },
      ];

      const chain = chainable();
      chain.orderBy = jest.fn().mockResolvedValue(fakePlaylists);

      mockKnex.mockImplementation(() => chain);

      const result = await playlistService.list('user-1');

      expect(result).toEqual(fakePlaylists);
      expect(chain.where).toHaveBeenCalledWith('user_id', 'user-1');
      expect(chain.orderBy).toHaveBeenCalledWith('created_at', 'desc');
    });

    it('should return empty array when user has no playlists', async () => {
      const chain = chainable();
      chain.orderBy = jest.fn().mockResolvedValue([]);

      mockKnex.mockImplementation(() => chain);

      const result = await playlistService.list('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('should create a playlist with uuid and return it', async () => {
      const newPlaylist = {
        id: 'generated-uuid',
        user_id: 'user-1',
        name: 'My Playlist',
        created_at: '2024-01-01',
      };

      const chain = chainable({
        returning: jest.fn().mockResolvedValue([newPlaylist]),
      });

      mockKnex.mockImplementation(() => chain);

      const result = await playlistService.create('user-1', { name: 'My Playlist' });

      expect(result).toEqual(newPlaylist);
      expect(chain.insert).toHaveBeenCalledWith({
        id: 'generated-uuid',
        user_id: 'user-1',
        name: 'My Playlist',
      });
    });
  });

  describe('update', () => {
    it('should update playlist name and return updated playlist', async () => {
      const existing = { id: 'pl-1', user_id: 'user-1', name: 'Old Name' };
      const updated = { id: 'pl-1', user_id: 'user-1', name: 'New Name' };

      // ownership check
      const ownershipChain = chainable({
        first: jest.fn().mockResolvedValue(existing),
      });

      // update query
      const updateChain = chainable({
        update: jest.fn().mockResolvedValue(1),
      });

      // fetch updated
      const fetchChain = chainable({
        first: jest.fn().mockResolvedValue(updated),
      });

      let callCount = 0;
      mockKnex.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return ownershipChain;
        if (callCount === 2) return updateChain;
        return fetchChain;
      });

      const result = await playlistService.update('user-1', 'pl-1', { name: 'New Name' });

      expect(result.name).toBe('New Name');
    });

    it('should throw NOT_FOUND when playlist does not belong to user', async () => {
      const chain = chainable({
        first: jest.fn().mockResolvedValue(undefined),
      });

      mockKnex.mockImplementation(() => chain);

      await expect(
        playlistService.update('user-1', 'nonexistent', { name: 'Test' })
      ).rejects.toThrow(AppError);

      try {
        await playlistService.update('user-1', 'nonexistent', { name: 'Test' });
      } catch (err) {
        expect(err.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('delete', () => {
    it('should delete playlist after verifying ownership', async () => {
      const existing = { id: 'pl-1', user_id: 'user-1', name: 'To Delete' };

      const ownershipChain = chainable({
        first: jest.fn().mockResolvedValue(existing),
      });

      const deleteChain = chainable({
        del: jest.fn().mockResolvedValue(1),
      });

      let callCount = 0;
      mockKnex.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return ownershipChain;
        return deleteChain;
      });

      await playlistService.delete('user-1', 'pl-1');

      expect(deleteChain.del).toHaveBeenCalled();
    });

    it('should throw NOT_FOUND when playlist does not belong to user', async () => {
      const chain = chainable({
        first: jest.fn().mockResolvedValue(undefined),
      });

      mockKnex.mockImplementation(() => chain);

      await expect(
        playlistService.delete('user-1', 'nonexistent')
      ).rejects.toThrow(AppError);

      try {
        await playlistService.delete('user-1', 'nonexistent');
      } catch (err) {
        expect(err.code).toBe('NOT_FOUND');
      }
    });

    it('should throw NOT_FOUND when another user tries to delete', async () => {
      const chain = chainable({
        first: jest.fn().mockResolvedValue(undefined),
      });

      mockKnex.mockImplementation(() => chain);

      await expect(
        playlistService.delete('user-2', 'pl-1')
      ).rejects.toThrow(AppError);
    });
  });
});
