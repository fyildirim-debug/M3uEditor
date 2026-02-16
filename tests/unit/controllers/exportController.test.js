const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock the database module before requiring app
const mockDb = jest.fn();
jest.mock('../../../src/config/database', () => mockDb);

// Mock ExportService (exported as singleton)
const mockExportService = {
  exportAsM3U: jest.fn(),
  generateShareUrl: jest.fn(),
  getSharedPlaylist: jest.fn(),
};
jest.mock('../../../src/services/ExportService', () => mockExportService);

const app = require('../../../src/app');
const jwtConfig = require('../../../src/config/jwt');

function generateToken(userId) {
  return jwt.sign({ userId }, jwtConfig.secret, { expiresIn: '1h' });
}

const USER_ID = 'user-uuid-1';
const PLAYLIST_ID = 'playlist-uuid-1';
const SHARE_TOKEN = 'abc123sharetoken';

describe('Export Controller', () => {
  let token;

  beforeAll(() => {
    token = generateToken(USER_ID);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/playlists/:id/export', () => {
    const M3U_CONTENT = '#EXTM3U\n#EXTINF:-1,Channel 1\nhttp://stream.url/1\n';

    it('should return M3U content with correct headers', async () => {
      mockExportService.exportAsM3U.mockResolvedValue(M3U_CONTENT);

      const res = await request(app)
        .get(`/api/playlists/${PLAYLIST_ID}/export`)
        .set('Authorization', `Bearer ${token}`)
        .buffer(true)
        .parse((res, cb) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => cb(null, data));
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/audio\/x-mpegurl/);
      expect(res.headers['content-disposition']).toBe('attachment; filename="playlist.m3u"');
      expect(res.body).toBe(M3U_CONTENT);
      expect(mockExportService.exportAsM3U).toHaveBeenCalledWith(USER_ID, PLAYLIST_ID);
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .get(`/api/playlists/${PLAYLIST_ID}/export`);

      expect(res.status).toBe(401);
    });

    it('should propagate service errors', async () => {
      const { createAppError } = require('../../../src/utils/AppError');
      mockExportService.exportAsM3U.mockRejectedValue(createAppError('NOT_FOUND'));

      const res = await request(app)
        .get(`/api/playlists/${PLAYLIST_ID}/export`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/playlists/:id/share', () => {
    it('should return share URL and token', async () => {
      const shareResult = { url: `/api/shared/${SHARE_TOKEN}`, token: SHARE_TOKEN };
      mockExportService.generateShareUrl.mockResolvedValue(shareResult);

      const res = await request(app)
        .post(`/api/playlists/${PLAYLIST_ID}/share`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(201);
      expect(res.body.url).toBe(`/api/shared/${SHARE_TOKEN}`);
      expect(res.body.token).toBe(SHARE_TOKEN);
      expect(mockExportService.generateShareUrl).toHaveBeenCalledWith(USER_ID, PLAYLIST_ID);
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .post(`/api/playlists/${PLAYLIST_ID}/share`);

      expect(res.status).toBe(401);
    });

    it('should propagate service errors', async () => {
      const { createAppError } = require('../../../src/utils/AppError');
      mockExportService.generateShareUrl.mockRejectedValue(createAppError('NOT_FOUND'));

      const res = await request(app)
        .post(`/api/playlists/${PLAYLIST_ID}/share`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/shared/:token', () => {
    const M3U_CONTENT = '#EXTM3U\n#EXTINF:-1,Shared Channel\nhttp://stream.url/shared\n';

    it('should return M3U content without requiring auth', async () => {
      mockExportService.getSharedPlaylist.mockResolvedValue(M3U_CONTENT);

      const res = await request(app)
        .get(`/api/shared/${SHARE_TOKEN}`)
        .buffer(true)
        .parse((res, cb) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => cb(null, data));
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/audio\/x-mpegurl/);
      expect(res.body).toBe(M3U_CONTENT);
      expect(mockExportService.getSharedPlaylist).toHaveBeenCalledWith(SHARE_TOKEN);
    });

    it('should return 404 for invalid token', async () => {
      const { createAppError } = require('../../../src/utils/AppError');
      mockExportService.getSharedPlaylist.mockRejectedValue(createAppError('NOT_FOUND'));

      const res = await request(app)
        .get('/api/shared/invalid-token');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
