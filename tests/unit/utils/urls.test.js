const { toAbsoluteMediaUrl, absoluteAppUrl } = require('../../../src/utils/urls');

describe('toAbsoluteMediaUrl', () => {
  const originalAppUrl = process.env.APP_URL;
  beforeEach(() => { process.env.APP_URL = 'https://m3u.example.com'; });
  afterAll(() => {
    if (originalAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = originalAppUrl;
  });

  test('makes an uploaded logo path absolute so players can resolve it', () => {
    // Yuklenen logolar goreli saklanir; export ciktisinda mutlak olmalidir.
    expect(toAbsoluteMediaUrl('/logos/68d25385-7b52-4959-b21e-44ed58c5bc98.jpg'))
      .toBe('https://m3u.example.com/logos/68d25385-7b52-4959-b21e-44ed58c5bc98.jpg');
  });

  test('leaves provider URLs untouched', () => {
    for (const value of [
      'http://cdn.example.com/logo.png',
      'https://cdn.example.com/logo.png',
      '//cdn.example.com/logo.png',
      'data:image/png;base64,AAAA',
    ]) {
      expect(toAbsoluteMediaUrl(value)).toBe(value);
    }
  });

  test('returns null for empty values instead of a bare base URL', () => {
    for (const value of [null, undefined, '', '   ']) {
      expect(toAbsoluteMediaUrl(value)).toBeNull();
    }
  });

  test('normalizes a trailing slash on the base URL', () => {
    expect(toAbsoluteMediaUrl('/logos/a.png', 'https://m3u.example.com/'))
      .toBe('https://m3u.example.com/logos/a.png');
  });

  test('resolves paths that do not start with a slash', () => {
    expect(toAbsoluteMediaUrl('logos/a.png')).toBe('https://m3u.example.com/logos/a.png');
  });

  test('redacts credentials that share and player URLs carry in the query string', () => {
    const { redactUrl } = require('../../../src/utils/urls');

    // Player'lar ozel baslik gonderemedigi icin sifre sorgu dizesinde gelir;
    // gunluge oldugu gibi yazilirsa diskte birikir.
    expect(redactUrl('/api/shared/abc?password=gizli123')).toBe('/api/shared/abc?password=REDACTED');
    expect(redactUrl('/get.php?username=u&password=p&type=m3u_plus'))
      .toBe('/get.php?username=REDACTED&password=REDACTED&type=m3u_plus');
    expect(redactUrl('/api/shared/abc?share_password=x')).toBe('/api/shared/abc?share_password=REDACTED');
    expect(redactUrl('/api/shared/abc?PASSWORD=x')).toBe('/api/shared/abc?PASSWORD=REDACTED');
  });

  test('leaves URLs without sensitive parameters untouched', () => {
    const { redactUrl } = require('../../../src/utils/urls');

    expect(redactUrl('/api/playlists')).toBe('/api/playlists');
    expect(redactUrl('/api/playlists/1/export?streamType=live'))
      .toBe('/api/playlists/1/export?streamType=live');
    expect(redactUrl('')).toBe('');
    expect(redactUrl(undefined)).toBe('');
  });

  test('builds absolute application URLs from a root-relative path', () => {
    expect(absoluteAppUrl('/api/shared/abc')).toBe('https://m3u.example.com/api/shared/abc');
    expect(absoluteAppUrl('api/shared/abc')).toBe('https://m3u.example.com/api/shared/abc');
  });
});
