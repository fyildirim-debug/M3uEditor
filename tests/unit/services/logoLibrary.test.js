/**
 * Hazir logo kutuphanesi: dizin ayristirma, ad turetme ve arama siralamasi.
 *
 * Siralama testleri gercek depodaki adlandirmayi taklit eder — logo adlari
 * kanal adlariyla birebir ayni degildir ("TRT 1 FHD" ↔ `trt-1-tr.png`), bu
 * yuzden dogru sonucun BASA gelmesi asil olcut.
 */

const mockSafeFetchJson = jest.fn();
jest.mock('../../../src/utils/safeFetch', () => ({
  safeFetchJson: (...args) => mockSafeFetchJson(...args),
  safeFetchText: jest.fn(),
  requestBuffer: jest.fn(),
  requestStream: jest.fn(),
  parseRemoteUrl: (value) => new URL(value),
}));

const logoLibrary = require('../../../src/services/LogoLibraryService');

const PATHS = [
  'countries/turkey/trt-1-tr.png',
  'countries/turkey/trt-1-hd-tr.png',
  'countries/turkey/trt-2-tr.png',
  'countries/turkey/a-haber-tr.png',
  'countries/turkey/a-news-tr.png',
  'countries/turkey/kanal-d-tr.png',
  'countries/turkey/show-tr.png',
  'countries/turkey/ntv-tr.png',
  'countries/romania/kanal-d-ro.png',
  'countries/united-kingdom/bbc-one-uk.png',
  'countries/united-kingdom/bbc-two-uk.png',
  'countries/germany/ntv-de.png',
  'misc/vod/the-matrix.png',
  'countries/turkey/0_all_logos_mosaic.md',
  'README.md',
];

function mockIndex(paths = PATHS) {
  mockSafeFetchJson.mockResolvedValue({
    data: { tree: paths.map((path) => ({ path, type: 'blob' })) },
  });
}

/** Servis modul duzeyinde tekil; her testte onbellek sifirlanir. */
function resetCache() {
  logoLibrary._cache = null;
  logoLibrary._pending = null;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetCache();
  mockIndex();
});

describe('logo name derivation', () => {
  test.each([
    ['countries/turkey/a-haber-tr.png', 'A Haber'],
    ['countries/united-kingdom/bbc-one-uk.png', 'BBC ONE'],
    ['misc/vod/the-matrix.png', 'The Matrix'],
    ['countries/turkey/show-tr.png', 'Show'],
  ])('%s -> %s', (path, expected) => {
    expect(logoLibrary.describe(path).name).toBe(expected);
  });

  test('normalises Turkish characters so "İstanbul" matches "istanbul"', () => {
    expect(logoLibrary.normalize('İstanbul Şöğüç')).toBe('istanbul soguc');
  });

  test('drops quality tags that never appear in logo names', () => {
    expect(logoLibrary.meaningfulTokens('TRT 1 FHD')).toEqual(['trt', '1']);
    expect(logoLibrary.meaningfulTokens('TR: NTV UHD')).toEqual(['ntv']);
  });

  test('keeps the raw tokens when everything looks like noise', () => {
    expect(logoLibrary.meaningfulTokens('HD')).toEqual(['hd']);
  });
});

describe('logo index', () => {
  test('indexes only images and groups them by folder', async () => {
    const { total, groups } = await logoLibrary.listGroups();

    expect(total).toBe(13); // 15 yol, 2'si markdown
    expect(groups.find((group) => group.id === 'turkey')).toMatchObject({ label: 'Turkey', count: 8 });
    expect(groups.map((group) => group.id)).toContain('vod');
  });

  test('fetches the index once and serves later searches from cache', async () => {
    await logoLibrary.search({ q: 'trt' });
    await logoLibrary.search({ q: 'bbc' });
    expect(mockSafeFetchJson).toHaveBeenCalledTimes(1);
  });

  test('serves a stale index when the refresh fails', async () => {
    await logoLibrary.search({ q: 'trt' });
    logoLibrary._cache.fetchedAt = 0; // TTL doldu
    mockSafeFetchJson.mockRejectedValue(new Error('github down'));

    const result = await logoLibrary.search({ q: 'trt' });
    expect(result.logos[0].name).toBe('TRT 1');
  });

  test('reports a clear error when there is no index at all', async () => {
    mockSafeFetchJson.mockRejectedValue(new Error('github down'));
    await expect(logoLibrary.search({ q: 'trt' })).rejects.toThrow(/erişilemiyor/i);
  });

  test('builds CDN urls, not raw GitHub urls', async () => {
    const { logos } = await logoLibrary.search({ q: 'a haber' });
    expect(logos[0].url).toBe('https://cdn.jsdelivr.net/gh/tv-logo/tv-logos@main/countries/turkey/a-haber-tr.png');
  });
});

describe('logo search ranking', () => {
  test.each([
    ['TRT 1 FHD', 'TRT 1'],
    ['a haber', 'A Haber'],
    ['Kanal D', 'Kanal D'],
    ['BBC One HD', 'BBC ONE'],
    ['the matrix', 'The Matrix'],
  ])('%s ranks %s first', async (query, expected) => {
    const { logos } = await logoLibrary.search({ q: query });
    expect(logos[0].name).toBe(expected);
  });

  test('prefers the requested group when scores tie', async () => {
    const romanian = await logoLibrary.search({ q: 'Kanal D', preferGroup: 'romania' });
    expect(romanian.logos[0].group).toBe('romania');

    const turkish = await logoLibrary.search({ q: 'Kanal D', preferGroup: 'turkey' });
    expect(turkish.logos[0].group).toBe('turkey');
  });

  test('a group filter excludes every other country', async () => {
    const { logos } = await logoLibrary.search({ q: 'ntv', group: 'germany' });
    expect(logos).toHaveLength(1);
    expect(logos[0].group).toBe('germany');
  });

  test('an unrelated query returns nothing instead of the whole library', async () => {
    const { total, logos } = await logoLibrary.search({ q: 'zzzz boyle bir kanal yok' });
    expect(total).toBe(0);
    expect(logos).toEqual([]);
  });

  test('a single weak token does not drag in half the library', async () => {
    // "d" tek basina her kelimede gecebilir; kelime siniri kontrolu bunu keser.
    const { total } = await logoLibrary.search({ q: 'd' });
    expect(total).toBeLessThan(4);
  });

  test('empty query browses everything, paginated', async () => {
    const first = await logoLibrary.search({ limit: 5 });
    expect(first.total).toBe(13);
    expect(first.logos).toHaveLength(5);

    const second = await logoLibrary.search({ limit: 5, offset: 5 });
    expect(second.logos[0].name).not.toBe(first.logos[0].name);
  });
});

describe('bestMatch', () => {
  test('returns a confident match for a real channel name', async () => {
    const match = await logoLibrary.bestMatch('TRT 1 FHD');
    expect(match).toMatchObject({ name: 'TRT 1', group: 'turkey' });
  });

  test('returns null rather than guessing when nothing is close', async () => {
    // Toplu logo atamasinda yanlis logo yapistirmaktansa atlamak dogrudur.
    expect(await logoLibrary.bestMatch('Mahalle Spor Kanalı 7')).toBeNull();
    expect(await logoLibrary.bestMatch('')).toBeNull();
  });

  test('honours the group restriction', async () => {
    const match = await logoLibrary.bestMatch('Kanal D', { group: 'romania' });
    expect(match.group).toBe('romania');
  });
});

describe('group derivation', () => {
  test('groups by top-level category, not by sub-folder', async () => {
    resetCache();
    mockIndex([
      'countries/turkey/trt-1-tr.png',
      'countries/nordic/norway/nrk1-no.png',
      'countries/united-states/us-local/wabc-us.png',
      'misc/vod/the-matrix.png',
    ]);

    const { groups } = await logoLibrary.listGroups();
    const ids = groups.map((group) => group.id).sort();
    // "norway" ve "us-local" ayri ulke degil; ust kategoriye toplanir.
    expect(ids).toEqual(['nordic', 'turkey', 'united-states', 'vod']);
  });

  test('a file sitting directly in a folder does not become its own group', async () => {
    resetCache();
    // Gercek depoda `misc/paypal-donate.png` var; onceki surumde dosya adi
    // grup listesine "paypal-donate.png" diye giriyordu.
    mockIndex(['misc/paypal-donate.png', 'misc/vod/the-matrix.png']);

    const { groups } = await logoLibrary.listGroups();
    expect(groups.map((group) => group.id).sort()).toEqual(['misc', 'vod']);
  });

  test('country groups carry an ISO code so the UI can localise them', async () => {
    resetCache();
    mockIndex(['countries/turkey/trt-1-tr.png', 'countries/international/x-int.png']);

    const { groups } = await logoLibrary.listGroups();
    expect(groups.find((group) => group.id === 'turkey')).toMatchObject({ code: 'TR', kind: 'country' });
    expect(groups.find((group) => group.id === 'international')).toMatchObject({ code: null, kind: 'other' });
  });
});
