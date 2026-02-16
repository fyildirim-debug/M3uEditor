const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock the database module before requiring app
const mockKnex = jest.fn();
jest.mock('../../../src/config/database', () => mockKnex);

// Mock ImportService as a class
const mockImportFromXtream = jest.fn();
const mockSyncFromXtream = jest.fn();
jest.mock('../../../src/services/ImportService', () => {
  return jest.fn().mockImplementation(() => ({
    importFromXtream: mockImportFromXtream,
    syncFromXtream: mockSyncFromXtream,
  }));
});

const app = require('../../../src/app');
const jwtConfig = require('../../../src/config/jwt');

function generateToken(userId) {
  return jwt.sign({ userId }, jwtConfig.secret, { expiresIn: '1h' });
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
      expect(mockImportFromXtream).toHaveBeenCalledWith(USER_ID, validBody, undefined, PLAYLIST_ID);
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
      expect(mockSyncFromXtream).toHaveBeenCalledWith(USER_ID, PLAYLIST_ID);
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .post(`/api/playlists/${PLAYLIST_ID}/sync`);

      expect(res.status).toBe(401);
    });
  });
});
