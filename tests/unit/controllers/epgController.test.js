const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock the database module before requiring app
const mockDb = jest.fn();
jest.mock('../../../src/config/database', () => mockDb);

// Mock EPGService
const mockEpgService = {
  addSource: jest.fn(),
  parseAndStore: jest.fn(),
  autoMatch: jest.fn(),
  getPreview: jest.fn(),
};
jest.mock('../../../src/services/EPGService', () => {
  return jest.fn().mockImplementation(() => mockEpgService);
});

const app = require('../../../src/app');
const jwtConfig = require('../../../src/config/jwt');

function generateToken(userId) {
  return jwt.sign({ userId }, jwtConfig.secret, { expiresIn: '1h' });
}

const USER_ID = 'user-uuid-1';
const PLAYLIST_ID = 'playlist-uuid-1';
const CHANNEL_ID = 'channel-uuid-1';
const SOURCE_ID = 'source-uuid-1';

describe('EPG Controller', () => {
  let token;

  beforeAll(() => {
    token = generateToken(USER_ID);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/epg/sources', () => {
    it('should add an EPG source and parse it', async () => {
      const mockSource = { id: SOURCE_ID, url: 'http://epg.example.com/xmltv.xml', status: 'pending' };
      mockEpgService.addSource.mockResolvedValue(mockSource);
      mockEpgService.parseAndStore.mockResolvedValue({ channelCount: 10, programCount: 50 });

      const res = await request(app)
        .post('/api/epg/sources')
        .set('Authorization', `Bearer ${token}`)
        .send({ url: 'http://epg.example.com/xmltv.xml' });

      expect(res.status).toBe(201);
      expect(res.body.source.id).toBe(SOURCE_ID);
      expect(res.body.channelCount).toBe(10);
      expect(res.body.programCount).toBe(50);
      expect(mockEpgService.addSource).toHaveBeenCalledWith(USER_ID, 'http://epg.example.com/xmltv.xml');
      expect(mockEpgService.parseAndStore).toHaveBeenCalledWith(SOURCE_ID);
    });

    it('should return 400 when url is missing', async () => {
      const res = await request(app)
        .post('/api/epg/sources')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when url is empty string', async () => {
      const res = await request(app)
        .post('/api/epg/sources')
        .set('Authorization', `Bearer ${token}`)
        .send({ url: '  ' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .post('/api/epg/sources')
        .send({ url: 'http://epg.example.com/xmltv.xml' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/epg/sources', () => {
    it('should list user EPG sources', async () => {
      const mockSources = [
        { id: SOURCE_ID, url: 'http://epg.example.com/xmltv.xml', status: 'active' },
      ];

      // Setup mock chain for db('epg_sources').where().orderBy()
      const mockOrderBy = jest.fn().mockResolvedValue(mockSources);
      const mockWhere = jest.fn().mockReturnValue({ orderBy: mockOrderBy });
      mockDb.mockReturnValue({ where: mockWhere });

      const res = await request(app)
        .get('/api/epg/sources')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(SOURCE_ID);
      expect(mockWhere).toHaveBeenCalledWith({ user_id: USER_ID });
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .get('/api/epg/sources');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/playlists/:id/epg/auto-match', () => {
    it('should auto-match channels with EPG', async () => {
      const mockMatches = [
        { channelId: 'ch-1', epgChannelId: 'epg-ch-1', confidence: 1.0 },
        { channelId: 'ch-2', epgChannelId: 'epg-ch-2', confidence: 0.7 },
      ];
      mockEpgService.autoMatch.mockResolvedValue(mockMatches);

      const res = await request(app)
        .post(`/api/playlists/${PLAYLIST_ID}/epg/auto-match`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].confidence).toBe(1.0);
      expect(mockEpgService.autoMatch).toHaveBeenCalledWith(USER_ID, PLAYLIST_ID);
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .post(`/api/playlists/${PLAYLIST_ID}/epg/auto-match`);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/channels/:id/epg/preview', () => {
    it('should return EPG preview for a channel', async () => {
      const mockPrograms = [
        { id: 'prog-1', title: 'News', start_time: '2024-01-01T08:00:00Z' },
        { id: 'prog-2', title: 'Sports', start_time: '2024-01-01T09:00:00Z' },
      ];
      mockEpgService.getPreview.mockResolvedValue(mockPrograms);

      const res = await request(app)
        .get(`/api/channels/${CHANNEL_ID}/epg/preview`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(mockEpgService.getPreview).toHaveBeenCalledWith(CHANNEL_ID, undefined);
    });

    it('should pass date query parameter', async () => {
      mockEpgService.getPreview.mockResolvedValue([]);

      const res = await request(app)
        .get(`/api/channels/${CHANNEL_ID}/epg/preview`)
        .set('Authorization', `Bearer ${token}`)
        .query({ date: '2024-01-15' });

      expect(res.status).toBe(200);
      expect(mockEpgService.getPreview).toHaveBeenCalledWith(CHANNEL_ID, '2024-01-15');
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .get(`/api/channels/${CHANNEL_ID}/epg/preview`);

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/channels/:id/epg', () => {
    it('should assign EPG ID to a channel', async () => {
      const updatedChannel = { id: CHANNEL_ID, name: 'Test Channel', epg_channel_id: 'epg.channel.1' };

      // Mock db for ownership check: db('channels').join().where().select().first()
      const mockFirst = jest.fn().mockResolvedValue({ id: CHANNEL_ID });
      const mockSelect = jest.fn().mockReturnValue({ first: mockFirst });
      const mockWhere = jest.fn().mockReturnValue({ select: mockSelect });
      const mockJoin = jest.fn().mockReturnValue({ where: mockWhere });

      // Mock db for update: db('channels').where().update().returning()
      const mockReturning = jest.fn().mockResolvedValue([updatedChannel]);
      const mockUpdate = jest.fn().mockReturnValue({ returning: mockReturning });
      const mockUpdateWhere = jest.fn().mockReturnValue({ update: mockUpdate });

      mockDb
        .mockReturnValueOnce({ join: mockJoin })
        .mockReturnValueOnce({ where: mockUpdateWhere });

      const res = await request(app)
        .put(`/api/channels/${CHANNEL_ID}/epg`)
        .set('Authorization', `Bearer ${token}`)
        .send({ epgChannelId: 'epg.channel.1' });

      expect(res.status).toBe(200);
      expect(res.body.epg_channel_id).toBe('epg.channel.1');
    });

    it('should return 404 when channel not found', async () => {
      const mockFirst = jest.fn().mockResolvedValue(null);
      const mockSelect = jest.fn().mockReturnValue({ first: mockFirst });
      const mockWhere = jest.fn().mockReturnValue({ select: mockSelect });
      const mockJoin = jest.fn().mockReturnValue({ where: mockWhere });

      mockDb.mockReturnValueOnce({ join: mockJoin });

      const res = await request(app)
        .put(`/api/channels/${CHANNEL_ID}/epg`)
        .set('Authorization', `Bearer ${token}`)
        .send({ epgChannelId: 'epg.channel.1' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 for invalid epgChannelId', async () => {
      const res = await request(app)
        .put(`/api/channels/${CHANNEL_ID}/epg`)
        .set('Authorization', `Bearer ${token}`)
        .send({ epgChannelId: 123 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should allow null epgChannelId to unassign', async () => {
      const updatedChannel = { id: CHANNEL_ID, name: 'Test Channel', epg_channel_id: null };

      const mockFirst = jest.fn().mockResolvedValue({ id: CHANNEL_ID });
      const mockSelect = jest.fn().mockReturnValue({ first: mockFirst });
      const mockWhere = jest.fn().mockReturnValue({ select: mockSelect });
      const mockJoin = jest.fn().mockReturnValue({ where: mockWhere });

      const mockReturning = jest.fn().mockResolvedValue([updatedChannel]);
      const mockUpdate = jest.fn().mockReturnValue({ returning: mockReturning });
      const mockUpdateWhere = jest.fn().mockReturnValue({ update: mockUpdate });

      mockDb
        .mockReturnValueOnce({ join: mockJoin })
        .mockReturnValueOnce({ where: mockUpdateWhere });

      const res = await request(app)
        .put(`/api/channels/${CHANNEL_ID}/epg`)
        .set('Authorization', `Bearer ${token}`)
        .send({ epgChannelId: null });

      expect(res.status).toBe(200);
      expect(res.body.epg_channel_id).toBeNull();
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .put(`/api/channels/${CHANNEL_ID}/epg`)
        .send({ epgChannelId: 'epg.channel.1' });

      expect(res.status).toBe(401);
    });
  });
});
