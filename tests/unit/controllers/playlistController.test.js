const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock the database module before requiring app
const mockKnex = jest.fn();
jest.mock('../../../src/config/database', () => mockKnex);

// Mock PlaylistService
const mockPlaylistService = {
  list: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};
jest.mock('../../../src/services/PlaylistService', () => mockPlaylistService);

const app = require('../../../src/app');
const jwtConfig = require('../../../src/config/jwt');

function generateToken(userId) {
  return jwt.sign({ userId }, jwtConfig.secret, { expiresIn: '1h' });
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
