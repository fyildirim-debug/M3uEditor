const EPGService = require('../../../src/services/EPGService');
const { AppError } = require('../../../src/utils/AppError');

// Mock dependencies
jest.mock('../../../src/config/database');
jest.mock('../../../src/parsers/EPGParser');

const db = require('../../../src/config/database');
const EPGParser = require('../../../src/parsers/EPGParser');

// Helper to build a mock knex query builder chain
function createQueryBuilder(overrides = {}) {
  const builder = {
    where: jest.fn().mockReturnThis(),
    join: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(0),
    returning: jest.fn().mockResolvedValue([]),
    first: jest.fn().mockResolvedValue(null),
    orderBy: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
  return builder;
}

describe('EPGService', () => {
  let epgService;

  beforeEach(() => {
    jest.clearAllMocks();
    epgService = new EPGService();
  });

  describe('addSource', () => {
    it('should create source with pending status', async () => {
      const userId = 'user-1';
      const url = 'http://epg.example.com/xmltv.xml';
      const createdSource = {
        id: 'source-uuid-1',
        user_id: userId,
        url,
        status: 'pending',
      };

      const builder = createQueryBuilder({
        returning: jest.fn().mockResolvedValue([createdSource]),
      });
      db.mockImplementation(() => builder);

      const result = await epgService.addSource(userId, url);

      expect(result).toEqual(createdSource);
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          url,
          status: 'pending',
        })
      );
    });

    it('should validate URL format and reject invalid URLs', async () => {
      await expect(epgService.addSource('user-1', 'not-a-url'))
        .rejects.toThrow(AppError);

      try {
        await epgService.addSource('user-1', 'not-a-url');
      } catch (err) {
        expect(err.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should reject empty or missing URL', async () => {
      await expect(epgService.addSource('user-1', ''))
        .rejects.toThrow(AppError);
      await expect(epgService.addSource('user-1', null))
        .rejects.toThrow(AppError);
    });

    it('should accept valid HTTP and HTTPS URLs', async () => {
      const createdSource = { id: 'src-1', user_id: 'user-1', url: 'https://epg.test.com/guide.xml', status: 'pending' };
      const builder = createQueryBuilder({
        returning: jest.fn().mockResolvedValue([createdSource]),
      });
      db.mockImplementation(() => builder);

      const result = await epgService.addSource('user-1', 'https://epg.test.com/guide.xml');
      expect(result.status).toBe('pending');
    });
  });

  describe('parseAndStore', () => {
    const sourceId = 'source-uuid-1';
    const mockSource = {
      id: sourceId,
      user_id: 'user-1',
      url: 'http://epg.example.com/xmltv.xml',
      status: 'pending',
    };

    const mockXml = `<?xml version="1.0"?>
<tv>
  <channel id="ch1"><display-name>Channel One</display-name></channel>
  <programme start="20240101120000" stop="20240101130000" channel="ch1">
    <title>Test Show</title><desc>A test show</desc>
  </programme>
</tv>`;

    const mockParsedData = {
      channels: [{ channelId: 'ch1', displayName: 'Channel One', iconUrl: '' }],
      programs: [
        {
          channelId: 'ch1',
          startTime: new Date('2024-01-01T12:00:00Z'),
          endTime: new Date('2024-01-01T13:00:00Z'),
          title: 'Test Show',
          description: 'A test show',
        },
      ],
    };

    let mockParserInstance;

    beforeEach(() => {
      mockParserInstance = { parse: jest.fn().mockReturnValue(mockParsedData) };
      EPGParser.mockImplementation(() => mockParserInstance);

      // Mock global fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(mockXml),
      });
    });

    afterEach(() => {
      delete global.fetch;
    });

    it('should fetch and store EPG data', async () => {
      const epgSourcesBuilder = createQueryBuilder({
        first: jest.fn().mockResolvedValue(mockSource),
      });
      const epgChannelsBuilder = createQueryBuilder();
      const epgProgramsBuilder = createQueryBuilder();

      db.mockImplementation((tableName) => {
        if (tableName === 'epg_sources') return epgSourcesBuilder;
        if (tableName === 'epg_channels') return epgChannelsBuilder;
        if (tableName === 'epg_programs') return epgProgramsBuilder;
        return createQueryBuilder();
      });

      const result = await epgService.parseAndStore(sourceId);

      expect(result.channelCount).toBe(1);
      expect(result.programCount).toBe(1);
      expect(global.fetch).toHaveBeenCalledWith(
        mockSource.url,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(mockParserInstance.parse).toHaveBeenCalledWith(mockXml);
      // Source status updated to 'active'
      expect(epgSourcesBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' })
      );
    });

    it('should handle fetch errors gracefully and keep existing data', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const epgSourcesBuilder = createQueryBuilder({
        first: jest.fn().mockResolvedValue(mockSource),
      });

      db.mockImplementation((tableName) => {
        if (tableName === 'epg_sources') return epgSourcesBuilder;
        return createQueryBuilder();
      });

      await expect(epgService.parseAndStore(sourceId)).rejects.toThrow(AppError);

      try {
        await epgService.parseAndStore(sourceId);
      } catch (err) {
        expect(err.code).toBe('EPG_FETCH_FAILED');
      }

      // Status should be updated to 'error'
      expect(epgSourcesBuilder.update).toHaveBeenCalledWith({ status: 'error' });
      // Existing epg_channels should NOT be deleted (del should not be called)
    });

    it('should throw NOT_FOUND when source does not exist', async () => {
      const builder = createQueryBuilder({ first: jest.fn().mockResolvedValue(null) });
      db.mockImplementation(() => builder);

      await expect(epgService.parseAndStore('nonexistent')).rejects.toThrow(AppError);

      try {
        await epgService.parseAndStore('nonexistent');
      } catch (err) {
        expect(err.code).toBe('NOT_FOUND');
      }
    });

    it('should delete existing channels before inserting new ones', async () => {
      const epgSourcesBuilder = createQueryBuilder({
        first: jest.fn().mockResolvedValue(mockSource),
      });
      const epgChannelsBuilder = createQueryBuilder();

      db.mockImplementation((tableName) => {
        if (tableName === 'epg_sources') return epgSourcesBuilder;
        if (tableName === 'epg_channels') return epgChannelsBuilder;
        if (tableName === 'epg_programs') return createQueryBuilder();
        return createQueryBuilder();
      });

      await epgService.parseAndStore(sourceId);

      // del() should have been called on epg_channels for this source
      expect(epgChannelsBuilder.del).toHaveBeenCalled();
    });

    it('should handle parse errors and set status to error', async () => {
      mockParserInstance.parse.mockImplementation(() => {
        throw new Error('Invalid XML');
      });

      const epgSourcesBuilder = createQueryBuilder({
        first: jest.fn().mockResolvedValue(mockSource),
      });

      db.mockImplementation((tableName) => {
        if (tableName === 'epg_sources') return epgSourcesBuilder;
        return createQueryBuilder();
      });

      await expect(epgService.parseAndStore(sourceId)).rejects.toThrow(AppError);

      expect(epgSourcesBuilder.update).toHaveBeenCalledWith({ status: 'error' });
    });
  });

  describe('autoMatch', () => {
    const userId = 'user-1';
    const playlistId = 'playlist-1';

    it('should return exact matches with highest confidence', async () => {
      const channelsBuilder = createQueryBuilder({
        select: jest.fn().mockResolvedValue([
          { id: 'ch-1', name: 'BBC News' },
          { id: 'ch-2', name: 'CNN' },
        ]),
      });

      const epgChannelsBuilder = createQueryBuilder({
        select: jest.fn().mockResolvedValue([
          { id: 'epg-1', channel_id: 'bbc.news', display_name: 'BBC News' },
          { id: 'epg-2', channel_id: 'cnn.us', display_name: 'CNN' },
        ]),
      });

      let callIndex = 0;
      db.mockImplementation((tableName) => {
        if (tableName === 'channels') return channelsBuilder;
        if (tableName === 'epg_channels') return epgChannelsBuilder;
        return createQueryBuilder();
      });

      const result = await epgService.autoMatch(userId, playlistId);

      expect(result).toHaveLength(2);
      // Both should be exact matches with confidence 1.0
      expect(result[0].confidence).toBe(1.0);
      expect(result[1].confidence).toBe(1.0);
    });

    it('should return partial matches with lower confidence', async () => {
      const channelsBuilder = createQueryBuilder({
        select: jest.fn().mockResolvedValue([
          { id: 'ch-1', name: 'BBC News HD' },
        ]),
      });

      const epgChannelsBuilder = createQueryBuilder({
        select: jest.fn().mockResolvedValue([
          { id: 'epg-1', channel_id: 'bbc.news', display_name: 'BBC News' },
        ]),
      });

      db.mockImplementation((tableName) => {
        if (tableName === 'channels') return channelsBuilder;
        if (tableName === 'epg_channels') return epgChannelsBuilder;
        return createQueryBuilder();
      });

      const result = await epgService.autoMatch(userId, playlistId);

      expect(result).toHaveLength(1);
      // "BBC News HD" contains "BBC News" → confidence 0.7
      expect(result[0].confidence).toBe(0.7);
      expect(result[0].epgChannelId).toBe('bbc.news');
    });

    it('should sort results by confidence descending', async () => {
      const channelsBuilder = createQueryBuilder({
        select: jest.fn().mockResolvedValue([
          { id: 'ch-1', name: 'BBC News HD' },
          { id: 'ch-2', name: 'CNN' },
        ]),
      });

      const epgChannelsBuilder = createQueryBuilder({
        select: jest.fn().mockResolvedValue([
          { id: 'epg-1', channel_id: 'bbc.news', display_name: 'BBC News' },
          { id: 'epg-2', channel_id: 'cnn.us', display_name: 'CNN' },
        ]),
      });

      db.mockImplementation((tableName) => {
        if (tableName === 'channels') return channelsBuilder;
        if (tableName === 'epg_channels') return epgChannelsBuilder;
        return createQueryBuilder();
      });

      const result = await epgService.autoMatch(userId, playlistId);

      expect(result).toHaveLength(2);
      // CNN exact match (1.0) should come before BBC partial (0.7)
      expect(result[0].confidence).toBeGreaterThanOrEqual(result[1].confidence);
      expect(result[0].confidence).toBe(1.0);
      expect(result[1].confidence).toBe(0.7);
    });

    it('should return empty array when no channels exist', async () => {
      const channelsBuilder = createQueryBuilder({
        select: jest.fn().mockResolvedValue([]),
      });

      db.mockImplementation((tableName) => {
        if (tableName === 'channels') return channelsBuilder;
        return createQueryBuilder();
      });

      const result = await epgService.autoMatch(userId, playlistId);
      expect(result).toEqual([]);
    });

    it('should return empty array when no EPG channels exist', async () => {
      const channelsBuilder = createQueryBuilder({
        select: jest.fn().mockResolvedValue([{ id: 'ch-1', name: 'Test' }]),
      });

      const epgChannelsBuilder = createQueryBuilder({
        select: jest.fn().mockResolvedValue([]),
      });

      db.mockImplementation((tableName) => {
        if (tableName === 'channels') return channelsBuilder;
        if (tableName === 'epg_channels') return epgChannelsBuilder;
        return createQueryBuilder();
      });

      const result = await epgService.autoMatch(userId, playlistId);
      expect(result).toEqual([]);
    });

    it('should handle word overlap matches with confidence 0.5', async () => {
      const channelsBuilder = createQueryBuilder({
        select: jest.fn().mockResolvedValue([
          { id: 'ch-1', name: 'Sports Live TV' },
        ]),
      });

      const epgChannelsBuilder = createQueryBuilder({
        select: jest.fn().mockResolvedValue([
          { id: 'epg-1', channel_id: 'sports.hd', display_name: 'Sports HD Channel' },
        ]),
      });

      db.mockImplementation((tableName) => {
        if (tableName === 'channels') return channelsBuilder;
        if (tableName === 'epg_channels') return epgChannelsBuilder;
        return createQueryBuilder();
      });

      const result = await epgService.autoMatch(userId, playlistId);

      expect(result).toHaveLength(1);
      // "Sports" is a common word → confidence 0.5
      expect(result[0].confidence).toBe(0.5);
    });
  });

  describe('getPreview', () => {
    it('should return programs for a channel', async () => {
      const channelId = 'ch-uuid-1';
      const mockPrograms = [
        { id: 'prog-1', title: 'Morning Show', start_time: new Date('2024-01-01T08:00:00Z') },
        { id: 'prog-2', title: 'News', start_time: new Date('2024-01-01T09:00:00Z') },
      ];

      const channelsBuilder = createQueryBuilder({
        first: jest.fn().mockResolvedValue({
          id: channelId,
          epg_channel_id: 'epg.ch1',
        }),
      });

      const epgChannelsBuilder = createQueryBuilder({
        first: jest.fn().mockResolvedValue({
          id: 'epg-db-uuid-1',
          channel_id: 'epg.ch1',
        }),
      });

      const epgProgramsBuilder = createQueryBuilder({
        orderBy: jest.fn().mockResolvedValue(mockPrograms),
      });

      db.mockImplementation((tableName) => {
        if (tableName === 'channels') return channelsBuilder;
        if (tableName === 'epg_channels') return epgChannelsBuilder;
        if (tableName === 'epg_programs') return epgProgramsBuilder;
        return createQueryBuilder();
      });

      const result = await epgService.getPreview(channelId, '2024-01-01');

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Morning Show');
      expect(result[1].title).toBe('News');
    });

    it('should return empty array when channel has no EPG ID', async () => {
      const channelsBuilder = createQueryBuilder({
        first: jest.fn().mockResolvedValue({
          id: 'ch-1',
          epg_channel_id: null,
        }),
      });

      db.mockImplementation((tableName) => {
        if (tableName === 'channels') return channelsBuilder;
        return createQueryBuilder();
      });

      const result = await epgService.getPreview('ch-1');
      expect(result).toEqual([]);
    });

    it('should throw NOT_FOUND when channel does not exist', async () => {
      const builder = createQueryBuilder({ first: jest.fn().mockResolvedValue(null) });
      db.mockImplementation(() => builder);

      await expect(epgService.getPreview('nonexistent')).rejects.toThrow(AppError);

      try {
        await epgService.getPreview('nonexistent');
      } catch (err) {
        expect(err.code).toBe('NOT_FOUND');
      }
    });

    it('should return empty array when EPG channel not found in database', async () => {
      const channelsBuilder = createQueryBuilder({
        first: jest.fn().mockResolvedValue({
          id: 'ch-1',
          epg_channel_id: 'unknown.epg.id',
        }),
      });

      const epgChannelsBuilder = createQueryBuilder({
        first: jest.fn().mockResolvedValue(null),
      });

      db.mockImplementation((tableName) => {
        if (tableName === 'channels') return channelsBuilder;
        if (tableName === 'epg_channels') return epgChannelsBuilder;
        return createQueryBuilder();
      });

      const result = await epgService.getPreview('ch-1');
      expect(result).toEqual([]);
    });
  });
});
