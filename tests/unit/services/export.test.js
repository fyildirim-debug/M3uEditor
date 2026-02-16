const crypto = require('crypto');
const { AppError } = require('../../../src/utils/AppError');

// --- Mock the database module ---
const mockKnex = jest.fn();
mockKnex.fn = { now: jest.fn().mockReturnValue('NOW()') };

jest.mock('../../../src/config/database', () => mockKnex);

const exportService = require('../../../src/services/ExportService');

// Helper to build chainable query mock
function chainable(overrides = {}) {
  const chain = {
    join: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    orderByRaw: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(1),
    ...overrides,
  };
  return chain;
}

describe('ExportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('exportAsM3U', () => {
    it('should return valid M3U content with channels ordered by category then channel sort_order', async () => {
      const playlist = { id: 'pl-1', user_id: 'user-1' };
      const dbChannels = [
        {
          name: 'Spor TV',
          logo_url: 'http://logo.com/spor.png',
          stream_url: 'http://stream.com/spor',
          epg_channel_id: 'spor.tv',
          extras: {},
          category_name: 'Spor',
          category_sort_order: 0,
          channel_sort_order: 0,
        },
        {
          name: 'Haber TV',
          logo_url: 'http://logo.com/haber.png',
          stream_url: 'http://stream.com/haber',
          epg_channel_id: 'haber.tv',
          extras: null,
          category_name: 'Haber',
          category_sort_order: 1,
          channel_sort_order: 0,
        },
      ];

      const playlistChain = chainable({
        first: jest.fn().mockResolvedValue(playlist),
      });

      const channelsChain = chainable();
      channelsChain.orderBy = jest.fn().mockResolvedValue(dbChannels);

      mockKnex.mockImplementation((table) => {
        if (table === 'playlists') return playlistChain;
        if (table === 'channels') return channelsChain;
        return chainable();
      });

      const result = await exportService.exportAsM3U('user-1', 'pl-1');

      expect(result).toContain('#EXTM3U');
      expect(result).toContain('tvg-id="spor.tv"');
      expect(result).toContain('tvg-name="Spor TV"');
      expect(result).toContain('tvg-logo="http://logo.com/spor.png"');
      expect(result).toContain('group-title="Spor"');
      expect(result).toContain('http://stream.com/spor');
      expect(result).toContain('tvg-id="haber.tv"');
      expect(result).toContain('group-title="Haber"');
      // Spor (category_sort_order=0) should appear before Haber (category_sort_order=1)
      expect(result.indexOf('Spor TV')).toBeLessThan(result.indexOf('Haber TV'));
    });

    it('should throw NOT_FOUND when playlist does not belong to user', async () => {
      const playlistChain = chainable({
        first: jest.fn().mockResolvedValue(undefined),
      });

      mockKnex.mockImplementation(() => playlistChain);

      await expect(
        exportService.exportAsM3U('user-1', 'nonexistent')
      ).rejects.toThrow(AppError);

      try {
        await exportService.exportAsM3U('user-1', 'nonexistent');
      } catch (err) {
        expect(err.code).toBe('NOT_FOUND');
      }
    });

    it('should handle channels without a category (null category)', async () => {
      const playlist = { id: 'pl-1', user_id: 'user-1' };
      const dbChannels = [
        {
          name: 'Uncategorized Channel',
          logo_url: null,
          stream_url: 'http://stream.com/unc',
          epg_channel_id: null,
          extras: null,
          category_name: null,
          category_sort_order: null,
          channel_sort_order: 0,
        },
      ];

      const playlistChain = chainable({
        first: jest.fn().mockResolvedValue(playlist),
      });

      const channelsChain = chainable();
      channelsChain.orderBy = jest.fn().mockResolvedValue(dbChannels);

      mockKnex.mockImplementation((table) => {
        if (table === 'playlists') return playlistChain;
        if (table === 'channels') return channelsChain;
        return chainable();
      });

      const result = await exportService.exportAsM3U('user-1', 'pl-1');

      expect(result).toContain('#EXTM3U');
      expect(result).toContain('Uncategorized Channel');
      expect(result).toContain('http://stream.com/unc');
      // Should not contain group-title for null category
      expect(result).not.toContain('group-title');
    });

    it('should return M3U with only header when playlist has no channels', async () => {
      const playlist = { id: 'pl-1', user_id: 'user-1' };

      const playlistChain = chainable({
        first: jest.fn().mockResolvedValue(playlist),
      });

      const channelsChain = chainable();
      channelsChain.orderBy = jest.fn().mockResolvedValue([]);

      mockKnex.mockImplementation((table) => {
        if (table === 'playlists') return playlistChain;
        if (table === 'channels') return channelsChain;
        return chainable();
      });

      const result = await exportService.exportAsM3U('user-1', 'pl-1');

      expect(result).toBe('#EXTM3U\n');
    });
  });

  describe('generateShareUrl', () => {
    it('should generate a unique share token and store it', async () => {
      const playlist = { id: 'pl-1', user_id: 'user-1' };

      const playlistChain = chainable({
        first: jest.fn().mockResolvedValue(playlist),
      });

      const updateChain = chainable({
        update: jest.fn().mockResolvedValue(1),
      });

      let callCount = 0;
      mockKnex.mockImplementation((table) => {
        if (table === 'playlists') {
          callCount++;
          if (callCount === 1) return playlistChain;
          return updateChain;
        }
        return chainable();
      });

      const result = await exportService.generateShareUrl('user-1', 'pl-1');

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('url');
      expect(result.token).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(result.url).toBe(`/api/shared/${result.token}`);
    });

    it('should throw NOT_FOUND when playlist does not belong to user', async () => {
      const playlistChain = chainable({
        first: jest.fn().mockResolvedValue(undefined),
      });

      mockKnex.mockImplementation(() => playlistChain);

      await expect(
        exportService.generateShareUrl('user-1', 'nonexistent')
      ).rejects.toThrow(AppError);

      try {
        await exportService.generateShareUrl('user-1', 'nonexistent');
      } catch (err) {
        expect(err.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('getSharedPlaylist', () => {
    it('should return M3U content for a valid share token', async () => {
      const playlist = { id: 'pl-1', share_token: 'abc123' };
      const dbChannels = [
        {
          name: 'Shared Channel',
          logo_url: 'http://logo.com/shared.png',
          stream_url: 'http://stream.com/shared',
          epg_channel_id: 'shared.tv',
          extras: {},
          category_name: 'Genel',
          category_sort_order: 0,
          channel_sort_order: 0,
        },
      ];

      const playlistChain = chainable({
        first: jest.fn().mockResolvedValue(playlist),
      });

      const channelsChain = chainable();
      channelsChain.orderBy = jest.fn().mockResolvedValue(dbChannels);

      mockKnex.mockImplementation((table) => {
        if (table === 'playlists') return playlistChain;
        if (table === 'channels') return channelsChain;
        return chainable();
      });

      const result = await exportService.getSharedPlaylist('abc123');

      expect(result).toContain('#EXTM3U');
      expect(result).toContain('Shared Channel');
      expect(result).toContain('http://stream.com/shared');
      expect(result).toContain('group-title="Genel"');
    });

    it('should throw NOT_FOUND for invalid share token', async () => {
      const playlistChain = chainable({
        first: jest.fn().mockResolvedValue(undefined),
      });

      mockKnex.mockImplementation(() => playlistChain);

      await expect(
        exportService.getSharedPlaylist('invalid-token')
      ).rejects.toThrow(AppError);

      try {
        await exportService.getSharedPlaylist('invalid-token');
      } catch (err) {
        expect(err.code).toBe('NOT_FOUND');
      }
    });
  });
});
