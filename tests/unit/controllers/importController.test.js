const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock the database module before requiring app
const mockKnex = jest.fn();
jest.mock('../../../src/config/database', () => mockKnex);

// Mock ImportService as a class
const mockImportFromXtream = jest.fn();
const mockSyncFromXtream = jest.fn();
const mockPreviewXtream = jest.fn();
jest.mock('../../../src/services/ImportService', () => {
  return jest.fn().mockImplementation(() => ({
    importFromXtream: mockImportFromXtream,
    syncFromXtream: mockSyncFromXtream,
  }));
});
jest.mock('../../../src/services/XtreamClient', () => {
  return jest.fn().mockImplementation(() => ({ preview: mockPreviewXtream }));
});

const app = require('../../../src/app');
const jwtConfig = require('../../../src/config/jwt');
const { signTestToken, stubActiveSession } = require('../../helpers/authToken');

function generateToken(userId) {
  return signTestToken(userId);
}

const USER_ID = 'user-uuid-1';
const PLAYLIST_ID = 'playlist-uuid-1';

describe('Import Controller', () => {
  let token;

  beforeAll(() => {
    token = generateToken(USER_ID);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    stubActiveSession();
  });

  describe('POST /api/playlists/:id/import/xtream', () => {
    const validBody = {
      serverUrl: 'http://xtream.example.com',
      username: 'testuser',
      password: 'testpass',
    };

    it('should return import result with valid credentials', async () => {
      mockImportFromXtream.mockResolvedValue({
        totalChannels: 1500,
        totalCategories: 25,
        duration: 3200,
      });

      const res = await request(app)
        .post(`/api/playlists/${PLAYLIST_ID}/import/xtream`)
        .set('Authorization', `Bearer ${token}`)
        .send(validBody);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        totalChannels: 1500,
        totalCategories: 25,
        duration: 3200,
      });
      expect(mockImportFromXtream).toHaveBeenCalledWith(
        USER_ID,
        validBody,
        undefined,
        PLAYLIST_ID,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('should return 400 when serverUrl is missing', async () => {
      const res = await request(app)
        .post(`/api/playlists/${PLAYLIST_ID}/import/xtream`)
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'testuser', password: 'testpass' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when username is missing', async () => {
      const res = await request(app)
        .post(`/api/playlists/${PLAYLIST_ID}/import/xtream`)
        .set('Authorization', `Bearer ${token}`)
        .send({ serverUrl: 'http://xtream.example.com', password: 'testpass' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when password is missing', async () => {
      const res = await request(app)
        .post(`/api/playlists/${PLAYLIST_ID}/import/xtream`)
        .set('Authorization', `Bearer ${token}`)
        .send({ serverUrl: 'http://xtream.example.com', username: 'testuser' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .post(`/api/playlists/${PLAYLIST_ID}/import/xtream`)
        .send(validBody);

      expect(res.status).toBe(401);
    });

    it('forwards stream type and category selections to the import service', async () => {
      mockImportFromXtream.mockResolvedValue({ totalChannels: 3, scopedCategories: { live: ['1'] } });
      const body = {
        ...validBody,
        streamTypes: ['live', 'vod'],
        categories: { live: ['1'], vod: [] },
      };

      const res = await request(app)
        .post(`/api/playlists/${PLAYLIST_ID}/import/xtream`)
        .set('Authorization', `Bearer ${token}`)
        .send(body);

      expect(res.status).toBe(200);
      expect(mockImportFromXtream).toHaveBeenCalledWith(
        USER_ID,
        body,
        undefined,
        PLAYLIST_ID,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('rejects malformed category selections', async () => {
      const res = await request(app)
        .post(`/api/playlists/${PLAYLIST_ID}/import/xtream`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validBody, categories: { live: '1' } });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(mockImportFromXtream).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/import/xtream/preview', () => {
    const validBody = {
      serverUrl: 'http://xtream.example.com',
      username: 'testuser',
      password: 'testpass',
    };

    it('returns category discovery without acquiring an import job', async () => {
      mockPreviewXtream.mockResolvedValue({
        server: { url: validBody.serverUrl, timezone: 'Europe/Istanbul' },
        types: {
          live: { available: true, categories: [{ id: '1', name: 'News' }] },
          vod: { available: true, categories: [] },
          series: { available: false, categories: [], error: 'unsupported' },
        },
      });

      const res = await request(app)
        .post('/api/import/xtream/preview')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody);

      expect(res.status).toBe(200);
      expect(res.body.types.live.categories).toEqual([{ id: '1', name: 'News' }]);
      expect(mockPreviewXtream).toHaveBeenCalledTimes(1);
      expect(mockImportFromXtream).not.toHaveBeenCalled();
    });

    it('returns XTREAM_AUTH_FAILED for rejected provider credentials', async () => {
      const { createAppError } = require('../../../src/utils/AppError');
      mockPreviewXtream.mockRejectedValue(createAppError('XTREAM_AUTH_FAILED'));

      const res = await request(app)
        .post('/api/import/xtream/preview')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody);

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('XTREAM_AUTH_FAILED');
    });

    it('requires application authentication', async () => {
      const res = await request(app).post('/api/import/xtream/preview').send(validBody);

      expect(res.status).toBe(401);
      expect(mockPreviewXtream).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/playlists/:id/sync', () => {
    it('should return sync result', async () => {
      mockSyncFromXtream.mockResolvedValue({
        added: 50,
        updated: 1400,
        removed: 10,
        duration: 4500,
      });

      const res = await request(app)
        .post(`/api/playlists/${PLAYLIST_ID}/sync`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        added: 50,
        updated: 1400,
        removed: 10,
        duration: 4500,
      });
      expect(mockSyncFromXtream).toHaveBeenCalledWith(
        USER_ID,
        PLAYLIST_ID,
        undefined,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
        { categories: undefined }
      );
    });

    it('should forward validated category selection to sync', async () => {
      mockSyncFromXtream.mockResolvedValue({ added: 1, updated: 2, removed: 0 });

      const res = await request(app)
        .post(`/api/playlists/${PLAYLIST_ID}/sync`)
        .set('Authorization', `Bearer ${token}`)
        .send({ categories: { live: ['1', '2'], vod: [] } });

      expect(res.status).toBe(200);
      expect(mockSyncFromXtream).toHaveBeenCalledWith(
        USER_ID,
        PLAYLIST_ID,
        undefined,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
        { categories: { live: ['1', '2'], vod: [] } }
      );
    });

    it('should reject malformed category selection', async () => {
      const res = await request(app)
        .post(`/api/playlists/${PLAYLIST_ID}/sync`)
        .set('Authorization', `Bearer ${token}`)
        .send({ categories: { live: 'not-an-array' } });

      expect(res.status).toBe(400);
      expect(mockSyncFromXtream).not.toHaveBeenCalled();
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .post(`/api/playlists/${PLAYLIST_ID}/sync`);

      expect(res.status).toBe(401);
    });
  });
});
