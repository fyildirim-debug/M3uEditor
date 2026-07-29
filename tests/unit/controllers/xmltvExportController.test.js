const { Readable, Writable } = require('stream');
const { once } = require('events');

const mockExportService = {
  resolveSharedPlaylist: jest.fn(),
};
const mockXmltvExportService = {
  createAuthenticatedStream: jest.fn(),
  createSharedStream: jest.fn(),
  getCoverage: jest.fn(),
};

jest.mock('../../../src/services/ExportService', () => mockExportService);
jest.mock('../../../src/services/XMLTVExportService', () => mockXmltvExportService);

const exportController = require('../../../src/controllers/exportController');
const exportRouter = require('../../../src/routes/export');
const { createAppError } = require('../../../src/utils/AppError');

class MockResponse extends Writable {
  constructor() {
    super();
    this.headers = {};
    this.chunks = [];
    this.headersSent = false;
  }

  setHeader(name, value) {
    this.headers[name.toLowerCase()] = value;
  }

  _write(chunk, _encoding, callback) {
    this.headersSent = true;
    this.chunks.push(chunk.toString());
    callback();
  }

  json(body) {
    this.jsonBody = body;
    return this;
  }
}

async function invokeStream(handler, req) {
  const res = new MockResponse();
  const next = jest.fn();
  await handler(req, res, next);
  if (!res.writableFinished && !next.mock.calls.length) await once(res, 'finish');
  return { res, next, body: res.chunks.join('') };
}

describe('XMLTV export controller and routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('streams an authenticated XMLTV response with download headers', async () => {
    mockXmltvExportService.createAuthenticatedStream.mockResolvedValue(Readable.from(['<tv>', '</tv>']));

    const { res, next, body } = await invokeStream(exportController.exportXmltv, {
      userId: 'user-1',
      params: { id: 'playlist-1' },
      query: { days: '5' },
    });

    expect(next).not.toHaveBeenCalled();
    expect(body).toBe('<tv></tv>');
    expect(res.headers['content-type']).toBe('application/xml; charset=utf-8');
    expect(res.headers['content-disposition']).toBe('attachment; filename="playlist.xml"');
    expect(mockXmltvExportService.createAuthenticatedStream).toHaveBeenCalledWith('user-1', 'playlist-1', '5');
  });

  test('uses the common token/password resolver before shared XMLTV streaming', async () => {
    const playlist = { id: 'playlist-1', user_id: 'user-1' };
    mockExportService.resolveSharedPlaylist.mockResolvedValue(playlist);
    mockXmltvExportService.createSharedStream.mockResolvedValue(Readable.from(['<tv/>']));

    const { next, body } = await invokeStream(exportController.getSharedXmltv, {
      params: { token: 'share-token' },
      headers: { 'x-share-password': 'secret-password' },
      query: {},
    });

    expect(next).not.toHaveBeenCalled();
    expect(body).toBe('<tv/>');
    expect(mockExportService.resolveSharedPlaylist).toHaveBeenCalledWith('share-token', 'secret-password');
    expect(mockXmltvExportService.createSharedStream).toHaveBeenCalledWith(playlist, undefined);
  });

  test('passes days validation failures to the HTTP error middleware', async () => {
    const error = createAppError('VALIDATION_ERROR');
    mockXmltvExportService.createAuthenticatedStream.mockRejectedValue(error);
    const res = new MockResponse();
    const next = jest.fn();

    await exportController.exportXmltv({ userId: 'u', params: { id: 'p' }, query: { days: '99' } }, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.headers['content-type']).toBeUndefined();
  });

  test('returns the authenticated playlist coverage payload', async () => {
    const coverage = { totalChannels: 10, matchedChannels: 8, channelsWithPrograms: 7 };
    mockXmltvExportService.getCoverage.mockResolvedValue(coverage);
    const res = new MockResponse();
    const next = jest.fn();

    await exportController.getEpgCoverage({ userId: 'u', params: { id: 'p' } }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.jsonBody).toEqual(coverage);
    expect(mockXmltvExportService.getCoverage).toHaveBeenCalledWith('u', 'p');
  });

  test('registers authenticated and public endpoints with the expected middleware boundary', () => {
    const routes = Object.fromEntries(exportRouter.stack
      .filter((layer) => layer.route)
      .map((layer) => [layer.route.path, layer.route.stack.length]));

    expect(routes['/playlists/:id/xmltv']).toBe(2);
    expect(routes['/playlists/:id/epg-coverage']).toBe(2);
    expect(routes['/shared/:token/xmltv']).toBe(1);
  });
});
