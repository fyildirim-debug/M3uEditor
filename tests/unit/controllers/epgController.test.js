const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockDb = jest.fn();
mockDb.fn = { now: jest.fn(() => 'NOW') };
jest.mock('../../../src/config/database', () => mockDb);

const mockEpgService = {
  addSource: jest.fn(),
  listSources: jest.fn(),
  parseAndStore: jest.fn(),
  autoMatch: jest.fn(),
  getPreview: jest.fn(),
  deleteSource: jest.fn(),
  refreshSource: jest.fn(),
  getGuide: jest.fn(),
  searchEpgChannels: jest.fn(),
};
jest.mock('../../../src/services/EPGService', () => jest.fn(() => mockEpgService));

const app = require('../../../src/app');
const jwtConfig = require('../../../src/config/jwt');
const { signTestToken, stubActiveSession } = require('../../helpers/authToken');
const { createAppError } = require('../../../src/utils/AppError');

const USER_ID = 'user-uuid-1';
const PLAYLIST_ID = 'playlist-uuid-1';
const CHANNEL_ID = 'channel-uuid-1';
const SOURCE_ID = 'source-uuid-1';

function token() {
  return signTestToken(USER_ID);
}

function chain({ first, rows = [], returning = [] } = {}) {
  const query = {};
  for (const method of ['join', 'where', 'andWhere', 'select', 'limit', 'update']) query[method] = jest.fn(() => query);
  query.first = jest.fn().mockResolvedValue(first);
  query.returning = jest.fn().mockResolvedValue(returning);
  query.then = (resolve, reject) => Promise.resolve(rows).then(resolve, reject);
  return query;
}

describe('EPG Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stubActiveSession();
    mockEpgService.listSources.mockResolvedValue([]);
  });

  test('adds, parses and returns a redacted EPG source', async () => {
    const source = { id: SOURCE_ID, url: 'https://epg.example.com/data.xml', status: 'pending' };
    mockEpgService.addSource.mockResolvedValue(source);
    mockEpgService.parseAndStore.mockResolvedValue({ channelCount: 10, programCount: 50 });
    mockEpgService.listSources.mockResolvedValue([{ ...source, status: 'active' }]);

    const response = await request(app).post('/api/epg/sources')
      .set('Authorization', `Bearer ${token()}`)
      .send({ url: 'https://epg.example.com/data.xml' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(expect.objectContaining({ channelCount: 10, programCount: 50 }));
    expect(mockEpgService.addSource).toHaveBeenCalledWith(USER_ID, 'https://epg.example.com/data.xml');
  });

  test('passes source validation failures through the error handler', async () => {
    mockEpgService.addSource.mockRejectedValue(createAppError('VALIDATION_ERROR', 'URL gerekli'));
    const response = await request(app).post('/api/epg/sources')
      .set('Authorization', `Bearer ${token()}`).send({});
    expect(response.status).toBe(400);
  });

  test('lists only sources returned by the tenant-scoped service', async () => {
    mockEpgService.listSources.mockResolvedValue([{ id: SOURCE_ID, url: 'Gizli EPG kaynağı' }]);
    const response = await request(app).get('/api/epg/sources').set('Authorization', `Bearer ${token()}`);
    expect(response.status).toBe(200);
    expect(mockEpgService.listSources).toHaveBeenCalledWith(USER_ID);
  });

  test('passes tenant, channel, date and timezone to preview', async () => {
    mockEpgService.getPreview.mockResolvedValue([{ id: 'program-1' }]);
    const response = await request(app).get(`/api/channels/${CHANNEL_ID}/epg/preview`)
      .set('Authorization', `Bearer ${token()}`).query({ date: '2026-07-27', tzOffset: '-180' });
    expect(response.status).toBe(200);
    expect(mockEpgService.getPreview).toHaveBeenCalledWith(USER_ID, CHANNEL_ID, '2026-07-27', '-180');
  });

  test('auto-matches within the authenticated playlist', async () => {
    mockEpgService.autoMatch.mockResolvedValue({ matched: 1, total: 2, matches: [] });
    const response = await request(app).post(`/api/playlists/${PLAYLIST_ID}/epg/auto-match`)
      .set('Authorization', `Bearer ${token()}`);
    expect(response.status).toBe(200);
    expect(mockEpgService.autoMatch).toHaveBeenCalledWith(USER_ID, PLAYLIST_ID);
  });

  test('assigns a source-scoped EPG channel after ownership checks', async () => {
    const ownedChannel = chain({ first: { id: CHANNEL_ID } });
    const ownedEpg = chain({ rows: [{ source_id: SOURCE_ID }] });
    const update = chain({ returning: [{ id: CHANNEL_ID, epg_channel_id: 'bbc.news', epg_source_id: SOURCE_ID }] });
    mockDb
      .mockReturnValueOnce(ownedChannel)
      .mockReturnValueOnce(ownedEpg)
      .mockReturnValueOnce(update);

    const response = await request(app).put(`/api/channels/${CHANNEL_ID}/epg`)
      .set('Authorization', `Bearer ${token()}`)
      .send({ epgChannelId: 'bbc.news', epgSourceId: SOURCE_ID });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({ epg_source_id: SOURCE_ID }));
  });

  test('rejects EPG channels that do not belong to the user', async () => {
    mockDb.mockReturnValueOnce(chain({ first: { id: CHANNEL_ID } })).mockReturnValueOnce(chain({ rows: [] }));
    const response = await request(app).put(`/api/channels/${CHANNEL_ID}/epg`)
      .set('Authorization', `Bearer ${token()}`).send({ epgChannelId: 'foreign.channel' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('protects every endpoint with authentication', async () => {
    await expect(request(app).get('/api/epg/sources')).resolves.toMatchObject({ status: 401 });
    await expect(request(app).post(`/api/playlists/${PLAYLIST_ID}/epg/auto-match`)).resolves.toMatchObject({ status: 401 });
    await expect(request(app).get(`/api/channels/${CHANNEL_ID}/epg/preview`)).resolves.toMatchObject({ status: 401 });
  });
});
