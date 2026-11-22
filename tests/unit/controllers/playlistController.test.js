const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock the database module before requiring app
const mockKnex = jest.fn();
jest.mock('../../../src/config/database', () => mockKnex);

// Mock PlaylistService
const mockPlaylistService = {
  list: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  updateSyncSettings: jest.fn(),
};
jest.mock('../../../src/services/PlaylistService', () => mockPlaylistService);

const app = require('../../../src/app');
const jwtConfig = require('../../../src/config/jwt');
const { signTestToken, stubActiveSession } = require('../../helpers/authToken');

function generateToken(userId) {
  return signTestToken(userId);
}

const USER_ID = 'user-uuid-1';
const PLAYLIST_ID = 'playlist-uuid-1';

describe('Playlist Controller', () => {
  let token;

  beforeAll(() => {
    token = generateToken(USER_ID);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    stubActiveSession();
  });

  describe('GET /api/playlists', () => {
    it('should return all playlists for the user', async () => {
      const mockPlaylists = [
        { id: 'pl-1', name: 'Playlist 1', user_id: USER_ID },
        { id: 'pl-2', name: 'Playlist 2', user_id: USER_ID },
      ];
      mockPlaylistService.list.mockResolvedValue(mockPlaylists);

      const res = await request(app)
        .get('/api/playlists')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(mockPlaylistService.list).toHaveBeenCalledWith(USER_ID);
    });

    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/playlists');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/playlists/:id', () => {
    const OWNED_ID = '3f2b8f0e-5d1a-4c3b-9a7e-1b2c3d4e5f60';

    it('returns the requested playlist scoped to the current user', async () => {
      mockPlaylistService.getById.mockResolvedValue({ id: OWNED_ID, name: 'Mine', user_id: USER_ID });

      const res = await request(app)
        .get(`/api/playlists/${OWNED_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.objectContaining({ id: OWNED_ID, name: 'Mine' }));
      expect(mockPlaylistService.getById).toHaveBeenCalledWith(USER_ID, OWNED_ID);
    });

    it('returns 404 when the playlist is not owned by the user', async () => {
      const { createAppError } = require('../../../src/utils/AppError');
      mockPlaylistService.getById.mockRejectedValue(createAppError('NOT_FOUND', 'Oynatma listesi bulunamadı'));

      const res = await request(app)
        .get(`/api/playlists/${OWNED_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for a malformed id without querying the database', async () => {
      const res = await request(app)
        .get('/api/playlists/not-a-uuid')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(mockPlaylistService.getById).not.toHaveBeenCalled();
    });

    it('requires authentication', async () => {
      const res = await request(app).get(`/api/playlists/${OWNED_ID}`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/playlists', () => {
    it('should create a playlist and return 201', async () => {
      const created = { id: PLAYLIST_ID, name: 'My Playlist', user_id: USER_ID };
      mockPlaylistService.create.mockResolvedValue(created);

      const res = await request(app)
        .post('/api/playlists')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'My Playlist' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('My Playlist');
      expect(mockPlaylistService.create).toHaveBeenCalledWith(USER_ID, { name: 'My Playlist' });
    });

    it('should return 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/playlists')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when name is empty string', async () => {
      const res = await request(app)
        .post('/api/playlists')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when name is whitespace only', async () => {
      const res = await request(app)
        .post('/api/playlists')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should trim whitespace from name', async () => {
      const created = { id: PLAYLIST_ID, name: 'Trimmed', user_id: USER_ID };
      mockPlaylistService.create.mockResolvedValue(created);

      await request(app)
        .post('/api/playlists')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '  Trimmed  ' });

      expect(mockPlaylistService.create).toHaveBeenCalledWith(USER_ID, { name: 'Trimmed' });
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .post('/api/playlists')
        .send({ name: 'Test' });

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/playlists/:id', () => {
    it('should update a playlist', async () => {
      const updated = { id: PLAYLIST_ID, name: 'Updated Name', user_id: USER_ID };
      mockPlaylistService.update.mockResolvedValue(updated);

      const res = await request(app)
        .put(`/api/playlists/${PLAYLIST_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
      expect(mockPlaylistService.update).toHaveBeenCalledWith(USER_ID, PLAYLIST_ID, { name: 'Updated Name' });
    });

    it('should return 400 when name is missing', async () => {
      const res = await request(app)
        .put(`/api/playlists/${PLAYLIST_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when name is empty string', async () => {
      const res = await request(app)
        .put(`/api/playlists/${PLAYLIST_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .put(`/api/playlists/${PLAYLIST_ID}`)
        .send({ name: 'Test' });

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/playlists/:id/sync-settings', () => {
    it('rejects intervals shorter than the configured minimum with a clear message', async () => {
      const res = await request(app)
        .put(`/api/playlists/${PLAYLIST_ID}/sync-settings`)
        .set('Authorization', `Bearer ${token}`)
        .send({ syncIntervalMinutes: 1 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toMatch(/15/);
      expect(mockPlaylistService.updateSyncSettings).not.toHaveBeenCalled();
    });

    it('accepts the options the editor offers and turning sync off', async () => {
      mockPlaylistService.updateSyncSettings.mockResolvedValue({ id: PLAYLIST_ID, sync_interval_minutes: 360 });
      for (const value of [15, 360, 10080, null]) {
        const res = await request(app)
          .put(`/api/playlists/${PLAYLIST_ID}/sync-settings`)
          .set('Authorization', `Bearer ${token}`)
          .send({ syncIntervalMinutes: value });
        expect(res.status).toBe(200);
      }
    });
  });

  describe('DELETE /api/playlists/:id', () => {
    it('should delete a playlist and return 204', async () => {
      mockPlaylistService.delete.mockResolvedValue();

      const res = await request(app)
        .delete(`/api/playlists/${PLAYLIST_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);
      expect(mockPlaylistService.delete).toHaveBeenCalledWith(USER_ID, PLAYLIST_ID);
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .delete(`/api/playlists/${PLAYLIST_ID}`);

      expect(res.status).toBe(401);
    });
  });
});
