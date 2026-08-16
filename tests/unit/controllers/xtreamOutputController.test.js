const mockService = {
  enable: jest.fn(),
  getConfiguration: jest.fn(),
  regenerate: jest.fn(),
  disable: jest.fn(),
  authenticate: jest.fn(),
  accountResponse: jest.fn(),
  getCategories: jest.fn(),
  getLiveStreams: jest.fn(),
  getVodStreams: jest.fn(),
  getSeries: jest.fn(),
  getVodInfo: jest.fn(),
  getSeriesInfo: jest.fn(),
  getEpg: jest.fn(),
  createXmltvStream: jest.fn(),
  createM3U: jest.fn(),
};
jest.mock('../../../src/services/XtreamOutputService', () => mockService);

const controller = require('../../../src/controllers/xtreamOutputController');

function response() {
  return {
    locals: {},
    statusCode: 200,
    body: undefined,
    headers: {},
    status: jest.fn(function status(code) { this.statusCode = code; return this; }),
    json: jest.fn(function json(body) { this.body = body; return this; }),
    send: jest.fn(function send(body) { this.body = body; return this; }),
    setHeader: jest.fn(function setHeader(name, value) { this.headers[name] = value; }),
    redirect: jest.fn(),
  };
}

describe('xtreamOutputController', () => {
  const playlist = { id: 'playlist-1' };

  beforeEach(() => jest.clearAllMocks());

  test('returns auth:0 with HTTP 200 for invalid player_api credentials', async () => {
    mockService.authenticate.mockResolvedValue({ status: 'invalid', playlist: null });
    const req = { query: { username: 'bad', password: 'wrong' }, params: {} };
    const res = response();

    await controller.playerApi(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ user_info: { auth: 0 } });
    expect(res.locals.xtreamAuthFailed).toBe(true);
  });

  test('returns 401 when output is disabled', async () => {
    mockService.authenticate.mockResolvedValue({ status: 'disabled', playlist: null });
    const res = response();

    await controller.playerApi({ query: { username: 'user', password: 'pass' }, params: {} }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.locals.xtreamAuthFailed).toBe(true);
  });

  test('dispatches category actions only after successful authentication', async () => {
    mockService.authenticate.mockResolvedValue({ status: 'valid', playlist });
    mockService.getCategories.mockResolvedValue([{ category_id: '1', category_name: 'News', parent_id: 0 }]);
    const res = response();

    await controller.playerApi({
      query: { username: 'user', password: 'pass', action: 'get_live_categories' },
      params: {},
    }, res, jest.fn());

    expect(mockService.getCategories).toHaveBeenCalledWith('playlist-1', 'live');
    expect(res.body).toEqual([{ category_id: '1', category_name: 'News', parent_id: 0 }]);
  });

  test('unknown actions return an empty array', async () => {
    mockService.authenticate.mockResolvedValue({ status: 'valid', playlist });
    const res = response();

    await controller.playerApi({
      query: { username: 'user', password: 'pass', action: 'not_supported' },
      params: {},
    }, res, jest.fn());

    expect(res.body).toEqual([]);
  });

  // Bu sunucu uzerinden yayin verilmiyor: yerel oynatma yollarini karsilayan
  // isleyiciler kaldirildi, geriye yalnizca katalog uclari kaldi.
  test('no local playback handlers are exposed', () => {
    expect(controller.playLive).toBeUndefined();
    expect(controller.playMovie).toBeUndefined();
    expect(controller.playSeries).toBeUndefined();
    expect(controller.setStreamMode).toBeUndefined();
  });
});
