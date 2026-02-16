const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock the database module before requiring app
const mockKnex = jest.fn();
jest.mock('../../../src/config/database', () => mockKnex);

// Mock ChannelService
const mockChannelService = {
  list: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  updateOrder: jest.fn(),
  bulkUpdate: jest.fn(),
  bulkMove: jest.fn(),
  search: jest.fn(),
};
jest.mock('../../../src/services/ChannelService', () => mockChannelService);

const app = require('../../../src/app');
const jwtConfig = require('../../../src/config/jwt');

function generateToken(userId) {
  return jwt.sign({ userId }, jwtConfig.secret, { expiresIn: '1h' });
}

const USER_ID = 'user-uuid-1';
const PLAYLIST_ID = 'playlist-uuid-1';
const CHANNEL_ID = 'channel-uuid-1';

describe('Channel Controller', () => {
  let token;

  beforeAll(() => {
    token = generateToken(USER_ID);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/playlists/:id/channels', () => {
    it('should return paginated channels', async () => {
      const mockResult = {
        channels: [
          { id: 'ch-1', name: 'Channel 1', sort_order: 0 },
          { id: 'ch-2', name: 'Channel 2', sort_order: 1 },
        ],
        total: 2,
      };
      mockChannelService.list.mockResolvedValue(mockResult);

      const res = await request(app)
        .get(`/api/playlists/${PLAYLIST_ID}/channels`)
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.channels).toHaveLength(2);
      expect(res.body.total).toBe(2);
      expect(mockChannelService.list).toHaveBeenCalledWith(
        USER_ID,
        PLAYLIST_ID,
        expect.objectContaining({ page: 1, limit: 10 })
      );
    });

    it('should pass search and categoryId params', async () => {
      mockChannelService.list.mockResolvedValue({ channels: [], total: 0 });

      await request(app)
        .get(`/api/playlists/${PLAYLIST_ID}/channels`)
        .set('Authorization', `Bearer ${token}`)
        .query({ search: 'sport', categoryId: 'cat-1' });

      expect(mockChannelService.list).toHaveBeenCalledWith(
        USER_ID,
        PLAYLIST_ID,
        expect.objectContaining({ search: 'sport', categoryId: 'cat-1' })
      );
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .get(`/api/playlists/${PLAYLIST_ID}/channels`);

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/channels/:id', () => {
    it('should update a channel', async () => {
      const updatedChannel = { id: CHANNEL_ID, name: 'Updated Name', logo_url: 'http://new.logo' };
      mockChannelService.update.mockResolvedValue(updatedChannel);

      const res = await request(app)
        .put(`/api/channels/${CHANNEL_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name', logo_url: 'http://new.logo' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
      expect(mockChannelService.update).toHaveBeenCalledWith(
        USER_ID,
        CHANNEL_ID,
        { name: 'Updated Name', logo_url: 'http://new.logo' }
      );
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .put(`/api/channels/${CHANNEL_ID}`)
        .send({ name: 'Test' });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/channels/:id', () => {
    it('should delete a channel and return 204', async () => {
      mockChannelService.delete.mockResolvedValue();

      const res = await request(app)
        .delete(`/api/channels/${CHANNEL_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);
      expect(mockChannelService.delete).toHaveBeenCalledWith(USER_ID, CHANNEL_ID);
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .delete(`/api/channels/${CHANNEL_ID}`);

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/channels/:id/order', () => {
    it('should update channel order', async () => {
      mockChannelService.updateOrder.mockResolvedValue();

      const res = await request(app)
        .put(`/api/channels/${CHANNEL_ID}/order`)
        .set('Authorization', `Bearer ${token}`)
        .send({ newPosition: 3 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockChannelService.updateOrder).toHaveBeenCalledWith(USER_ID, CHANNEL_ID, 3);
    });

    it('should return 400 for negative newPosition', async () => {
      const res = await request(app)
        .put(`/api/channels/${CHANNEL_ID}/order`)
        .set('Authorization', `Bearer ${token}`)
        .send({ newPosition: -1 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for non-numeric newPosition', async () => {
      const res = await request(app)
        .put(`/api/channels/${CHANNEL_ID}/order`)
        .set('Authorization', `Bearer ${token}`)
        .send({ newPosition: 'abc' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when newPosition is missing', async () => {
      const res = await request(app)
        .put(`/api/channels/${CHANNEL_ID}/order`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .put(`/api/channels/${CHANNEL_ID}/order`)
        .send({ newPosition: 0 });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/channels/bulk', () => {
    it('should bulk update channels', async () => {
      mockChannelService.bulkUpdate.mockResolvedValue({ updated: 3 });

      const res = await request(app)
        .post('/api/channels/bulk')
        .set('Authorization', `Bearer ${token}`)
        .send({
          action: 'update',
          channelIds: ['ch-1', 'ch-2', 'ch-3'],
          updates: { name: 'Bulk Name' },
        });

      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(3);
      expect(mockChannelService.bulkUpdate).toHaveBeenCalledWith(
        USER_ID,
        ['ch-1', 'ch-2', 'ch-3'],
        { name: 'Bulk Name' }
      );
    });

    it('should bulk move channels', async () => {
      mockChannelService.bulkMove.mockResolvedValue({ moved: 2 });

      const res = await request(app)
        .post('/api/channels/bulk')
        .set('Authorization', `Bearer ${token}`)
        .send({
          action: 'move',
          channelIds: ['ch-1', 'ch-2'],
          targetCategoryId: 'cat-target',
        });

      expect(res.status).toBe(200);
      expect(res.body.moved).toBe(2);
      expect(mockChannelService.bulkMove).toHaveBeenCalledWith(
        USER_ID,
        ['ch-1', 'ch-2'],
        'cat-target'
      );
    });

    it('should return 400 for invalid action', async () => {
      const res = await request(app)
        .post('/api/channels/bulk')
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'invalid', channelIds: ['ch-1'] });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for empty channelIds', async () => {
      const res = await request(app)
        .post('/api/channels/bulk')
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'update', channelIds: [] });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when channelIds is not an array', async () => {
      const res = await request(app)
        .post('/api/channels/bulk')
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'update', channelIds: 'not-array' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .post('/api/channels/bulk')
        .send({ action: 'update', channelIds: ['ch-1'] });

      expect(res.status).toBe(401);
    });
  });
});
