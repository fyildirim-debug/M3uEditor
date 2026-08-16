/**
 * Bozuk kanallarin adresini calisan bir kaynaktan tazeleme.
 *
 * Kritik davranislar: hic test edilmemis kanallara dokunmamak, yeni adresi
 * YAZMADAN once dogrulamak, ve yalnizca stream_url'i degistirip kanalin geri
 * kalanini (ad, kategori, logo, EPG) korumak.
 */

const mockDb = jest.fn();
mockDb.raw = jest.fn().mockResolvedValue({ rows: [] });
mockDb.fn = { now: jest.fn(() => 'NOW') };
jest.mock('../../../src/config/database', () => mockDb);

const mockAuthenticate = jest.fn();
const mockGetAllChannels = jest.fn();
jest.mock('../../../src/services/XtreamClient', () => (
  class XtreamClient {
    constructor(serverUrl, username, password) {
      this.credentials = { serverUrl, username, password };
      XtreamClient.lastCredentials = this.credentials;
    }

    authenticate(...args) { return mockAuthenticate(...args); }

    getAllChannels(...args) { return mockGetAllChannels(...args); }
  }
));

const mockCheckUrl = jest.fn();
jest.mock('../../../src/services/StreamHealthService', () => ({ checkUrl: (...args) => mockCheckUrl(...args) }));

jest.mock('../../../src/utils/crypto', () => ({
  decrypt: (value) => String(value).replace('enc:', ''),
  encrypt: (value) => `enc:${value}`,
}));

const repairService = require('../../../src/services/StreamRepairService');
const XtreamClient = require('../../../src/services/XtreamClient');

const PLAYLIST = {
  id: 'pl-1',
  user_id: 'user-1',
  xtream_server_url: 'http://kaynak.ornek:8080',
  xtream_username: 'kullanici',
  xtream_password_enc: 'enc:gizli',
};

function builder({ rows = [], first } = {}) {
  const query = {};
  for (const method of ['where', 'andWhere', 'whereIn', 'orderBy', 'select', 'limit', 'update']) {
    query[method] = jest.fn(() => query);
  }
  query.first = jest.fn().mockResolvedValue(first);
  query.then = (resolve, reject) => Promise.resolve(rows).then(resolve, reject);
  return query;
}

/** playlists -> tek satir, channels -> hedef kanallar. */
function mockTables({ playlist = PLAYLIST, channels = [] } = {}) {
  const chain = { channels: null };
  mockDb.mockImplementation((table) => {
    if (table === 'playlists') return builder({ first: playlist });
    chain.channels = builder({ rows: channels });
    return chain.channels;
  });
  return chain;
}

const DEAD = [
  { id: 'ch-1', name: 'TRT 1 FHD', stream_url: 'http://eski/1.ts', stream_type: 'live' },
  { id: 'ch-2', name: 'Kanal D', stream_url: 'http://eski/2.ts', stream_type: 'live' },
];

const SOURCE = {
  channels: [
    { name: 'TR: TRT1 HD', url: 'http://yeni/11.ts', streamType: 'live' },
    { name: 'Bilinmeyen Kanal', url: 'http://yeni/99.ts', streamType: 'live' },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.raw.mockResolvedValue({ rows: [{ id: 'ch-1' }] });
  mockAuthenticate.mockResolvedValue(true);
  mockGetAllChannels.mockResolvedValue(SOURCE);
  mockCheckUrl.mockResolvedValue({ ok: true, status: 200 });
});

describe('credential resolution', () => {
  test('falls back to the playlist stored Xtream source', async () => {
    mockTables({ channels: DEAD });

    await repairService.repairFromXtream('user-1', 'pl-1', {});

    // Kullanicinin parolayi tekrar yazmasi gerekmiyor.
    expect(XtreamClient.lastCredentials).toEqual({
      serverUrl: 'http://kaynak.ornek:8080', username: 'kullanici', password: 'gizli',
    });
  });

  test('an explicit source overrides the stored one', async () => {
    mockTables({ channels: DEAD });

    await repairService.repairFromXtream('user-1', 'pl-1', {
      serverUrl: 'http://baska.ornek:8080', username: 'baska', password: 'parola',
    });

    expect(XtreamClient.lastCredentials.serverUrl).toBe('http://baska.ornek:8080');
  });

  test('explains what is missing when there is no source at all', async () => {
    mockTables({ playlist: { id: 'pl-1', user_id: 'user-1' }, channels: DEAD });

    await expect(repairService.repairFromXtream('user-1', 'pl-1', {}))
      .rejects.toThrow(/Xtream bilgisi yok/i);
  });

  test('another user cannot repair a playlist', async () => {
    mockTables({ playlist: null });
    await expect(repairService.repairFromXtream('user-2', 'pl-1', {})).rejects.toThrow(/bulunamadı/i);
  });
});

describe('matching and repair', () => {
  test('matches across naming differences and writes only the url', async () => {
    mockTables({ channels: DEAD });

    const result = await repairService.repairFromXtream('user-1', 'pl-1', {});

    // "TRT 1 FHD" ile "TR: TRT1 HD" ayni kanal; "Kanal D" kaynakta yok.
    expect(result.repaired).toBe(1);
    expect(result.notFound).toBe(1);
    expect(result.notFoundSample).toEqual(['Kanal D']);

    const [sql, bindings] = mockDb.raw.mock.calls[0];
    expect(sql).toMatch(/SET stream_url = CASE id/);
    // Kanalin geri kalani korunur: sorgu yalnizca adres ve saglik bayraklarina dokunur.
    expect(sql).not.toMatch(/\bname\s*=/);
    expect(sql).not.toMatch(/category_id\s*=/);
    expect(sql).toMatch(/last_check_ok = NULL/);
    expect(bindings).toContain('http://yeni/11.ts');
  });

  test('verifies a candidate before writing it', async () => {
    mockTables({ channels: DEAD });
    mockCheckUrl.mockResolvedValue({ ok: false, status: 404 });

    const result = await repairService.repairFromXtream('user-1', 'pl-1', {});

    // Bozugu bozukla degistirmek listeyi "onarilmis" gosterip sorunu gizlerdi.
    expect(mockCheckUrl).toHaveBeenCalledWith('http://yeni/11.ts');
    expect(result.repaired).toBe(0);
    expect(result.notWorking).toBe(1);
    expect(mockDb.raw).not.toHaveBeenCalled();
  });

  test('verification can be turned off', async () => {
    mockTables({ channels: DEAD });

    await repairService.repairFromXtream('user-1', 'pl-1', { verify: false });

    expect(mockCheckUrl).not.toHaveBeenCalled();
    expect(mockDb.raw).toHaveBeenCalled();
  });

  test('does not rewrite a channel whose url already equals the source', async () => {
    mockTables({ channels: [{ id: 'ch-1', name: 'TRT 1', stream_url: 'http://yeni/11.ts', stream_type: 'live' }] });

    const result = await repairService.repairFromXtream('user-1', 'pl-1', {});

    // Adres zaten dogru; kanal baska bir sebeple olu, degistirmek fayda etmez.
    expect(result.repaired).toBe(0);
    expect(mockDb.raw).not.toHaveBeenCalled();
  });

  test('dryRun reports without touching anything', async () => {
    mockTables({ channels: DEAD });

    const result = await repairService.repairFromXtream('user-1', 'pl-1', { dryRun: true });

    expect(result).toMatchObject({ dryRun: true, wouldRepair: 1, notFound: 1 });
    expect(result.sample[0]).toEqual({ channel: 'TRT 1 FHD', source: 'TR: TRT1 HD' });
    expect(mockDb.raw).not.toHaveBeenCalled();
  });

  test('says what to do when nothing is marked dead', async () => {
    mockTables({ channels: [] });

    const result = await repairService.repairFromXtream('user-1', 'pl-1', {});

    expect(result.repaired).toBe(0);
    expect(result.note).toMatch(/start_health_scan/);
    expect(mockGetAllChannels).not.toHaveBeenCalled();
  });

  test('asks the source only for the stream types it needs', async () => {
    mockTables({ channels: [{ id: 'ch-9', name: 'Film', stream_url: 'http://eski/9.mkv', stream_type: 'vod' }] });

    await repairService.repairFromXtream('user-1', 'pl-1', {});

    // Yalnizca vod istenir; canli katalogu bosuna cekilmez.
    expect(mockGetAllChannels).toHaveBeenCalledWith(['vod'], {});
  });
});
