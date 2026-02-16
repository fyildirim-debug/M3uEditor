const ImportService = require('../../../src/services/ImportService');
const { AppError } = require('../../../src/utils/AppError');

// Mock dependencies
jest.mock('../../../src/config/database');
jest.mock('../../../src/services/XtreamClient');

const db = require('../../../src/config/database');
const XtreamClient = require('../../../src/services/XtreamClient');

// Helper to build a mock knex query builder chain
function createQueryBuilder(overrides = {}) {
  const builder = {
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockResolvedValue(1),
    onConflict: jest.fn().mockReturnThis(),
    merge: jest.fn().mockResolvedValue(undefined),
    returning: jest.fn().mockResolvedValue([]),
    first: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
  return builder;
}

describe('ImportService', () => {
  let importService;
  let mockXtreamInstance;

  const userId = 'user-uuid-1';
  const credentials = {
    serverUrl: 'http://xtream.example.com',
    username: 'testuser',
    password: 'testpass',
  };

  const mockCategories = [
    { category_id: '1', category_name: 'Sports' },
    { category_id: '2', category_name: 'News' },
  ];

  const mockChannels = [
    { stream_id: '101', name: 'ESPN', stream_icon: 'espn.png', epg_channel_id: 'espn.us', category_id: '1' },
    { stream_id: '102', name: 'BBC News', stream_icon: 'bbc.png', epg_channel_id: 'bbc.uk', category_id: '2' },
    { stream_id: '103', name: 'CNN', stream_icon: null, epg_channel_id: null, category_id: '1' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    importService = new ImportService();

    // Setup mock XtreamClient instance
    mockXtreamInstance = {
      authenticate: jest.fn().mockResolvedValue({ serverInfo: {} }),
      getAllChannels: jest.fn().mockResolvedValue({
        categories: mockCategories,
        channels: mockChannels,
      }),
    };
    XtreamClient.mockImplementation(() => mockXtreamInstance);
  });

  describe('importFromXtream', () => {
    let playlistsBuilder;
    let categoriesBuilder;
    let channelsBuilder;

    beforeEach(() => {
      const playlistId = 'playlist-uuid-1';

      // Mock db('playlists') - no existing playlist, then create one
      playlistsBuilder = createQueryBuilder({
        first: jest.fn().mockResolvedValue(null),
        returning: jest.fn().mockResolvedValue([{
          id: playlistId,
          user_id: userId,
          name: 'Xtream - testuser@http://xtream.example.com',
          xtream_server_url: 'http://xtream.example.com',
          xtream_username: 'testuser',
          xtream_password_enc: 'testpass',
        }]),
      });

      // Mock db('categories') - no existing categories
      categoriesBuilder = createQueryBuilder({
        first: jest.fn().mockResolvedValue(null),
        returning: jest.fn()
          .mockResolvedValueOnce([{ id: 'cat-uuid-1', name: 'Sports' }])
          .mockResolvedValueOnce([{ id: 'cat-uuid-2', name: 'News' }]),
      });

      // Mock db('channels')
      channelsBuilder = createQueryBuilder();

      db.mockImplementation((tableName) => {
        if (tableName === 'playlists') return playlistsBuilder;
        if (tableName === 'categories') return categoriesBuilder;
        if (tableName === 'channels') return channelsBuilder;
        return createQueryBuilder();
      });
    });

    it('should create playlist and import channels', async () => {
      const result = await importService.importFromXtream(userId, credentials);

      // XtreamClient was constructed with correct credentials
      expect(XtreamClient).toHaveBeenCalledWith(
        'http://xtream.example.com', 'testuser', 'testpass'
      );
      expect(mockXtreamInstance.authenticate).toHaveBeenCalled();
      expect(mockXtreamInstance.getAllChannels).toHaveBeenCalled();

      // Result has correct counts
      expect(result.totalChannels).toBe(3);
      expect(result.totalCategories).toBe(2);
      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should call onProgress with monotonically increasing values', async () => {
      // Use 5 channels to test with batch size
      const manyChannels = [];
      for (let i = 0; i < 2500; i++) {
        manyChannels.push({
          stream_id: `${i}`,
          name: `Channel ${i}`,
          stream_icon: null,
          epg_channel_id: null,
          category_id: '1',
        });
      }
      mockXtreamInstance.getAllChannels.mockResolvedValue({
        categories: [{ category_id: '1', category_name: 'Test' }],
        channels: manyChannels,
      });

      // Adjust categories mock for single category
      categoriesBuilder.returning = jest.fn()
        .mockResolvedValue([{ id: 'cat-uuid-1', name: 'Test' }]);

      const progressCalls = [];
      const onProgress = jest.fn((p) => progressCalls.push(p));

      await importService.importFromXtream(userId, credentials, onProgress);

      // Should have 3 batches: 1000, 1000, 500
      expect(onProgress).toHaveBeenCalledTimes(3);

      // Verify monotonically increasing
      for (let i = 1; i < progressCalls.length; i++) {
        expect(progressCalls[i].processed).toBeGreaterThan(progressCalls[i - 1].processed);
      }

      // All calls have same total
      for (const call of progressCalls) {
        expect(call.total).toBe(2500);
      }

      // Last call should have processed === total
      expect(progressCalls[progressCalls.length - 1].processed).toBe(2500);
    });

    it('should return correct totalChannels and totalCategories', async () => {
      const result = await importService.importFromXtream(userId, credentials);

      expect(result.totalChannels).toBe(mockChannels.length);
      expect(result.totalCategories).toBe(mockCategories.length);
    });

    it('should handle re-import by using upsert (ON CONFLICT DO UPDATE)', async () => {
      // Simulate existing playlist found
      playlistsBuilder.first = jest.fn().mockResolvedValue({
        id: 'playlist-uuid-1',
        user_id: userId,
        xtream_server_url: 'http://xtream.example.com',
        xtream_username: 'testuser',
        xtream_password_enc: 'testpass',
      });

      await importService.importFromXtream(userId, credentials);

      // Verify channels were inserted with onConflict merge
      expect(channelsBuilder.insert).toHaveBeenCalled();
      expect(channelsBuilder.onConflict).toHaveBeenCalledWith(['playlist_id', 'stream_url']);
      expect(channelsBuilder.merge).toHaveBeenCalledWith(
        ['name', 'logo_url', 'category_id', 'extras', 'updated_at']
      );
    });

    it('should create categories from Xtream data', async () => {
      await importService.importFromXtream(userId, credentials);

      // Categories should be inserted
      expect(categoriesBuilder.insert).toHaveBeenCalledTimes(2);

      // First category insert
      const firstInsert = categoriesBuilder.insert.mock.calls[0][0];
      expect(firstInsert.name).toBe('Sports');
      expect(firstInsert.playlist_id).toBe('playlist-uuid-1');

      // Second category insert
      const secondInsert = categoriesBuilder.insert.mock.calls[1][0];
      expect(secondInsert.name).toBe('News');
    });

    it('should construct correct stream URLs', async () => {
      await importService.importFromXtream(userId, credentials);

      const insertedBatch = channelsBuilder.insert.mock.calls[0][0];
      expect(insertedBatch[0].stream_url).toBe(
        'http://xtream.example.com/live/testuser/testpass/101.ts'
      );
      expect(insertedBatch[1].stream_url).toBe(
        'http://xtream.example.com/live/testuser/testpass/102.ts'
      );
    });

    it('should throw when Xtream API authentication fails', async () => {
      const authError = new AppError('XTREAM_AUTH_FAILED', 'Auth failed', 502);
      mockXtreamInstance.authenticate.mockRejectedValue(authError);

      await expect(importService.importFromXtream(userId, credentials))
        .rejects.toThrow(AppError);

      try {
        await importService.importFromXtream(userId, credentials);
      } catch (err) {
        expect(err.code).toBe('XTREAM_AUTH_FAILED');
      }
    });

    it('should throw when Xtream API connection fails', async () => {
      const connError = new AppError('XTREAM_CONNECTION_FAILED', 'Connection failed', 502);
      mockXtreamInstance.authenticate.mockRejectedValue(connError);

      await expect(importService.importFromXtream(userId, credentials))
        .rejects.toThrow(AppError);

      try {
        await importService.importFromXtream(userId, credentials);
      } catch (err) {
        expect(err.code).toBe('XTREAM_CONNECTION_FAILED');
      }
    });

    it('should wrap unexpected errors as IMPORT_FAILED', async () => {
      mockXtreamInstance.authenticate.mockRejectedValue(new Error('Unexpected'));

      try {
        await importService.importFromXtream(userId, credentials);
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.code).toBe('IMPORT_FAILED');
      }
    });

    it('should not call onProgress when no channels exist', async () => {
      mockXtreamInstance.getAllChannels.mockResolvedValue({
        categories: [],
        channels: [],
      });

      const onProgress = jest.fn();
      const result = await importService.importFromXtream(userId, credentials, onProgress);

      expect(onProgress).not.toHaveBeenCalled();
      expect(result.totalChannels).toBe(0);
      expect(result.totalCategories).toBe(0);
    });

    it('should reuse existing categories on re-import', async () => {
      // Simulate existing category found
      categoriesBuilder.first = jest.fn()
        .mockResolvedValueOnce({ id: 'existing-cat-1', name: 'Sports' })
        .mockResolvedValueOnce({ id: 'existing-cat-2', name: 'News' });

      await importService.importFromXtream(userId, credentials);

      // Should NOT insert new categories since they already exist
      expect(categoriesBuilder.insert).not.toHaveBeenCalled();
    });
  });

  describe('syncFromXtream', () => {
    it('should throw NOT_FOUND when playlist does not exist', async () => {
      const builder = createQueryBuilder({ first: jest.fn().mockResolvedValue(null) });
      db.mockImplementation(() => builder);

      await expect(importService.syncFromXtream(userId, 'nonexistent-id'))
        .rejects.toThrow(AppError);

      try {
        await importService.syncFromXtream(userId, 'nonexistent-id');
      } catch (err) {
        expect(err.code).toBe('NOT_FOUND');
      }
    });

    it('should throw VALIDATION_ERROR when playlist has no Xtream credentials', async () => {
      const builder = createQueryBuilder({
        first: jest.fn().mockResolvedValue({
          id: 'playlist-1',
          user_id: userId,
          xtream_server_url: null,
          xtream_username: null,
          xtream_password_enc: null,
        }),
      });
      db.mockImplementation(() => builder);

      try {
        await importService.syncFromXtream(userId, 'playlist-1');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should return added, updated, removed counts', async () => {
      const playlistId = 'playlist-uuid-sync';
      const existingPlaylist = {
        id: playlistId,
        user_id: userId,
        xtream_server_url: 'http://xtream.example.com',
        xtream_username: 'testuser',
        xtream_password_enc: 'testpass',
      };

      // Track call sequence for db mock
      let callCount = 0;
      db.mockImplementation((tableName) => {
        if (tableName === 'playlists') {
          const b = createQueryBuilder({
            first: jest.fn().mockResolvedValue(existingPlaylist),
            returning: jest.fn().mockResolvedValue([existingPlaylist]),
          });
          return b;
        }
        if (tableName === 'channels') {
          callCount++;
          if (callCount === 1) {
            // count query (before sync)
            return createQueryBuilder({
              first: jest.fn().mockResolvedValue({ count: '2' }),
            });
          }
          if (callCount === 2) {
            // select existing URLs (before sync)
            return createQueryBuilder({
              select: jest.fn().mockResolvedValue([
                { stream_url: 'http://xtream.example.com/live/testuser/testpass/101.ts' },
                { stream_url: 'http://xtream.example.com/live/testuser/testpass/999.ts' },
              ]),
            });
          }
          if (callCount === 4) {
            // select URLs after sync
            return createQueryBuilder({
              select: jest.fn().mockResolvedValue([
                { stream_url: 'http://xtream.example.com/live/testuser/testpass/101.ts' },
                { stream_url: 'http://xtream.example.com/live/testuser/testpass/102.ts' },
                { stream_url: 'http://xtream.example.com/live/testuser/testpass/103.ts' },
              ]),
            });
          }
          // Default for bulk upsert calls
          return createQueryBuilder();
        }
        if (tableName === 'categories') {
          return createQueryBuilder({
            first: jest.fn().mockResolvedValue(null),
            returning: jest.fn()
              .mockResolvedValueOnce([{ id: 'cat-1', name: 'Sports' }])
              .mockResolvedValueOnce([{ id: 'cat-2', name: 'News' }]),
          });
        }
        return createQueryBuilder();
      });

      const result = await importService.syncFromXtream(userId, playlistId);

      expect(result).toHaveProperty('added');
      expect(result).toHaveProperty('updated');
      expect(result).toHaveProperty('removed');
      expect(typeof result.duration).toBe('number');
      // 101 was existing and still present → updated
      // 102, 103 are new → added
      // 999 was existing but not in new set → removed
      expect(result.updated).toBe(1);
      expect(result.added).toBe(2);
      expect(result.removed).toBe(1);
    });
  });
});
