/**
 * Web aramasi (yigin ici SearXNG).
 *
 * En kritik iki davranis: JSON ucuna dogru istegin gitmesi ve SSRF kapisinin
 * yalnizca YAPILANDIRMADAN gelen adrese acilmasi — sayfa acma cagrisi hedefi
 * kullanici/model etkisinde oldugu icin bu kapiyi asla almamali.
 */

const mockSafeFetchJson = jest.fn();
const mockSafeFetchText = jest.fn();
jest.mock('../../../src/utils/safeFetch', () => ({
  safeFetchJson: (...args) => mockSafeFetchJson(...args),
  safeFetchText: (...args) => mockSafeFetchText(...args),
  requestBuffer: jest.fn(),
  requestStream: jest.fn(),
  parseRemoteUrl: (value) => new URL(value),
}));

jest.mock('../../../src/config', () => ({
  search: { searxngUrl: 'http://searxng:8080' },
}));

const webSearch = require('../../../src/services/WebSearchService');

const RESPONSE = {
  data: {
    results: [
      { title: 'TRT 1 - Vikipedi', url: 'https://tr.wikipedia.org/wiki/TRT_1', content: 'TRT 1, TRT bünyesindeki kanal.', engine: 'wikipedia' },
      { title: 'TRT 1 canlı', url: 'https://www.trt1.com.tr', content: 'Resmî site', engine: 'google' },
    ],
    answers: ['TRT 1 bir televizyon kanalıdır'],
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSafeFetchJson.mockResolvedValue(RESPONSE);
});

describe('web search', () => {
  test('asks SearXNG for JSON and normalises the results', async () => {
    const result = await webSearch.search('TRT 1 nedir', { limit: 5, language: 'tr' });

    const [url, options] = mockSafeFetchJson.mock.calls[0];
    expect(url).toContain('http://searxng:8080/search?');
    // JSON bicimi SearXNG'de varsayilan kapali; acikca istenmeli.
    expect(url).toContain('format=json');
    expect(url).toContain('language=tr');
    expect(options.allowPrivateHost).toBe(true);

    expect(result.count).toBe(2);
    expect(result.results[0]).toMatchObject({ title: 'TRT 1 - Vikipedi', url: 'https://tr.wikipedia.org/wiki/TRT_1' });
    expect(result.answers).toEqual(['TRT 1 bir televizyon kanalıdır']);
  });

  test('caps the number of results', async () => {
    await webSearch.search('x', { limit: 999 });
    // Ust sinir 20; model baglamini bir aramayla doldurmasin.
    const result = await webSearch.search('x', { limit: 999 });
    expect(result.results.length).toBeLessThanOrEqual(20);
  });

  test('rejects an empty query', async () => {
    await expect(webSearch.search('   ')).rejects.toThrow(/sorgusu gerekli/i);
    expect(mockSafeFetchJson).not.toHaveBeenCalled();
  });

  test('reports a friendly error when the search engine is down', async () => {
    mockSafeFetchJson.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(webSearch.search('trt')).rejects.toThrow(/yanıt vermiyor/i);
  });
});

describe('opening a page', () => {
  test('extracts readable text from HTML', async () => {
    mockSafeFetchText.mockResolvedValue({
      headers: { 'content-type': 'text/html; charset=utf-8' },
      url: 'https://ornek.test/a',
      text: '<html><head><style>b{}</style></head><body><h1>Başlık</h1><p>Metin <b>burada</b></p><script>x=1</script></body></html>',
    });

    const result = await webSearch.openPage('https://ornek.test/a');

    expect(result.text).toContain('Başlık');
    expect(result.text).toContain('Metin burada');
    // Script ve style govdeye sizmamali.
    expect(result.text).not.toContain('x=1');
    expect(result.text).not.toContain('b{}');
  });

  test('NEVER takes the private-host shortcut', async () => {
    mockSafeFetchText.mockResolvedValue({ headers: {}, text: 'merhaba' });

    await webSearch.openPage('https://ornek.test/a');

    // Hedef arama sonucundan, yani dolayli olarak modelden gelir. Bu cagriya
    // ic ag kapisi acilsaydi asistan sunucunun ic servislerini okuyabilirdi.
    const [, options] = mockSafeFetchText.mock.calls[0];
    expect(options.allowPrivateHost).toBeUndefined();
  });

  test('rejects a non-http scheme', async () => {
    await expect(webSearch.openPage('file:///etc/passwd')).rejects.toThrow(/http/i);
    expect(mockSafeFetchText).not.toHaveBeenCalled();
  });

  test('truncates a long page and says so', async () => {
    mockSafeFetchText.mockResolvedValue({
      headers: { 'content-type': 'text/plain' },
      text: 'a'.repeat(50_000),
    });

    const result = await webSearch.openPage('https://ornek.test/uzun');
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(12_000);
  });
});

describe('availability', () => {
  test('is available when a URL is configured', () => {
    expect(webSearch.available).toBe(true);
  });

  test('probe reports success', async () => {
    await expect(webSearch.probe()).resolves.toMatchObject({ available: true });
  });

  test('probe reports failure instead of throwing', async () => {
    mockSafeFetchJson.mockRejectedValue(new Error('down'));
    await expect(webSearch.probe()).resolves.toMatchObject({ available: false });
  });
});
