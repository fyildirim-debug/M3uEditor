const mockDb = jest.fn();
mockDb.fn = { now: jest.fn() };
mockDb.raw = jest.fn();
jest.mock('../../../src/config/database', () => mockDb);
jest.mock('../../../src/services/ExportService', () => ({ createXtreamPlaylist: jest.fn() }));
jest.mock('../../../src/services/XMLTVExportService', () => ({ createSharedStream: jest.fn() }));

const xtreamOutputService = require('../../../src/services/XtreamOutputService');

const APP_HOST = 'iptv.self.test';
const PROVIDER = 'http://saglayici.example:8080';

/**
 * Bu dosyanin tek isi su garantiyi kilitlemek: Xtream cikisinda oynaticiya
 * verilen hicbir YAYIN adresi bu sunucuyu isaret etmez, her zaman kanalin
 * kendi `stream_url` degeridir. Alan bos birakilirsa oynatici adresi
 * `server_info`'dan kendisi kurar, yani yayini bu sunucudan ister; bu yuzden
 * "bos direct_source" da regresyon sayilir.
 */
function listQuery(rows) {
  const query = {
    join: () => query,
    leftJoin: () => query,
    where: () => query,
    whereNull: () => query,
    orWhere: () => query,
    distinct: () => query,
    select: () => query,
    orderBy: () => query,
    orderByRaw: () => query,
    then: (resolve, reject) => Promise.resolve(rows).then(resolve, reject),
  };
  return query;
}

function firstQuery(value) {
  const query = {
    leftJoin: () => query,
    where: () => query,
    select: () => query,
    first: async () => value,
  };
  return query;
}

function channelRow(overrides = {}) {
  return {
    id: 'channel-1',
    xtream_id: '5',
    name: 'Kanal',
    // Yuklenen logo yalnizca bu sunucuda durur; gorsel adresi yayin adresi degildir.
    logo_url: '/logos/11111111-1111-4111-8111-111111111111.png?v=1',
    epg_channel_id: 'k.tr',
    stream_url: `${PROVIDER}/live/u/p/5.ts`,
    extras: {},
    created_at: new Date('2026-07-28T10:00:00Z'),
    sort_order: 0,
    stream_type: 'live',
    category_xtream_id: '1',
    ...overrides,
  };
}

/** Bu sunucunun adini tasiyan her degerin yaprak anahtarini toplar. */
function keysMentioningSelf(value, key = '$') {
  if (typeof value === 'string') return value.includes(APP_HOST) ? [key] : [];
  if (Array.isArray(value)) return value.flatMap((item) => keysMentioningSelf(item, key));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([childKey, child]) => keysMentioningSelf(child, childKey));
  }
  return [];
}

async function playerFacingResponses() {
  const playlist = { id: 'playlist-1', output_created_at: new Date('2026-07-28T10:00:00Z') };
  mockDb.mockReturnValue(listQuery([channelRow()]));
  const responses = {
    account: xtreamOutputService.accountResponse(playlist, 'user', 'pass'),
    liveStreams: await xtreamOutputService.getLiveStreams(playlist),
    vodStreams: await xtreamOutputService.getVodStreams(playlist),
    series: await xtreamOutputService.getSeries(playlist.id),
  };
  mockDb.mockReturnValue(firstQuery(channelRow({
    stream_type: 'vod', stream_url: `${PROVIDER}/movie/u/p/9.mkv`,
  })));
  responses.vodInfo = await xtreamOutputService.getVodInfo(playlist.id, '5');
  mockDb.mockReturnValue(firstQuery(channelRow({
    stream_type: 'series', stream_url: `${PROVIDER}/series/u/p/7.mp4`,
  })));
  responses.seriesInfo = await xtreamOutputService.getSeriesInfo(playlist.id, '5');
  return responses;
}

describe('Xtream output never hands the player this server as a stream address', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_URL = `https://${APP_HOST}`;
  });

  afterAll(() => { delete process.env.APP_URL; });

  test('every playback address is the provider address', async () => {
    const { liveStreams, vodStreams, vodInfo, seriesInfo } = await playerFacingResponses();

    expect(liveStreams[0].direct_source).toBe(`${PROVIDER}/live/u/p/5.ts`);
    expect(vodStreams[0].direct_source).toBe(`${PROVIDER}/live/u/p/5.ts`);
    expect(vodInfo.movie_data.direct_source).toBe(`${PROVIDER}/movie/u/p/9.mkv`);
    expect(seriesInfo.episodes['1'][0].direct_source).toBe(`${PROVIDER}/series/u/p/7.mp4`);
  });

  test('no playback address is left empty for the player to build from server_info', async () => {
    const { liveStreams, vodStreams, vodInfo, seriesInfo } = await playerFacingResponses();

    for (const source of [
      liveStreams[0].direct_source,
      vodStreams[0].direct_source,
      vodInfo.movie_data.direct_source,
      seriesInfo.episodes['1'][0].direct_source,
    ]) {
      expect(source).toBeTruthy();
      expect(source).not.toContain(APP_HOST);
    }
  });

  test('this server appears only as the catalogue endpoint and on uploaded artwork', async () => {
    const responses = await playerFacingResponses();

    // `url`: player_api'nin kendi adresi (protokol geregi). Diger uc anahtar
    // yalnizca gorsel. Listeye yeni bir anahtar eklenmesi, oynaticiya bu
    // sunucuyu gosteren yeni bir alan sizdigi anlamina gelir.
    expect([...new Set(keysMentioningSelf(responses))].sort())
      .toEqual(['cover', 'movie_image', 'stream_icon', 'url']);
  });
});
