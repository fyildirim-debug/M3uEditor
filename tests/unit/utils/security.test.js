const { encrypt, decrypt, hashToken } = require('../../../src/utils/crypto');
const { parseRemoteUrl, isBlockedIp, createPinnedLookup } = require('../../../src/utils/safeFetch');
const { parsePagination, validateIdArray, validateRegex, buildDateRange } = require('../../../src/utils/validation');

describe('security utilities', () => {
  test('encrypts credentials with randomized authenticated encryption', () => {
    const first = encrypt('provider-secret');
    const second = encrypt('provider-secret');
    expect(first).toMatch(/^enc:v1:/);
    expect(first).not.toBe(second);
    expect(decrypt(first)).toBe('provider-secret');

    const tampered = `${first.slice(0, -1)}${first.endsWith('A') ? 'B' : 'A'}`;
    expect(() => decrypt(tampered)).toThrow();
  });

  test('hashes bearer secrets deterministically without storing the original', () => {
    expect(hashToken('token')).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken('token')).toBe(hashToken('token'));
    expect(hashToken('token')).not.toContain('token');
  });

  test.each([
    '127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1',
  ])('blocks non-public address %s', (address) => expect(isBlockedIp(address)).toBe(true));

  test.each(['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111'])('allows public address %s', (address) => {
    expect(isBlockedIp(address)).toBe(false);
  });

  test('accepts only credential-free HTTP(S) remote URLs', () => {
    expect(parseRemoteUrl('https://example.com/data.xml').hostname).toBe('example.com');
    for (const value of ['file:///etc/passwd', 'ftp://example.com/file', 'https://user:pass@example.com/', 'not-a-url']) {
      expect(() => parseRemoteUrl(value)).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    }
  });

  test('pins DNS lookups using the callback shape requested by Node', () => {
    const resolved = { address: '203.0.113.10', family: 4 };
    const lookup = createPinnedLookup(resolved);
    const allCallback = jest.fn();
    const singleCallback = jest.fn();

    lookup('example.com', { all: true }, allCallback);
    lookup('example.com', { family: 4 }, singleCallback);

    expect(allCallback).toHaveBeenCalledWith(null, [resolved]);
    expect(singleCallback).toHaveBeenCalledWith(null, resolved.address, resolved.family);
  });

  test('caps pagination and rejects ambiguous numeric input', () => {
    expect(parsePagination('2', '5000', 250)).toEqual({ page: 2, limit: 250 });
    expect(() => parsePagination('1foo', '20')).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    expect(() => parsePagination('1', '1.5')).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });

  test('deduplicates bounded identifier arrays and rejects empty values', () => {
    expect(validateIdArray(['a', 'a', 'b'])).toEqual(['a', 'b']);
    expect(() => validateIdArray([''])).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    expect(() => validateIdArray(Array.from({ length: 1001 }, (_, index) => String(index))))
      .toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });

  test('rejects unsafe regular expressions', () => {
    expect(() => validateRegex('^news-[0-9]+$')).not.toThrow();
    expect(() => validateRegex('(a+)+$')).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });

  test('bounds channel text fields so one request cannot write megabytes per row', () => {
    const { validateChannelUpdates, CHANNEL_FIELD_LIMITS } = require('../../../src/utils/validation');

    expect(validateChannelUpdates({ name: '  Haber TV  ' })).toEqual({ name: 'Haber TV' });
    expect(validateChannelUpdates({ name: 'x'.repeat(CHANNEL_FIELD_LIMITS.name) })).toBeTruthy();
    expect(() => validateChannelUpdates({ name: 'x'.repeat(CHANNEL_FIELD_LIMITS.name + 1) }))
      .toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    expect(() => validateChannelUpdates({ logo_url: 'x'.repeat(CHANNEL_FIELD_LIMITS.logo_url + 1) }))
      .toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    expect(() => validateChannelUpdates({ stream_url: 'x'.repeat(CHANNEL_FIELD_LIMITS.stream_url + 1) }))
      .toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });

  test('rejects non-string and control-character channel field values', () => {
    const { validateChannelUpdates } = require('../../../src/utils/validation');

    for (const value of [123, true, {}, []]) {
      expect(() => validateChannelUpdates({ name: value })).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    }
    for (const value of ['a\nb', 'a\rb', 'a\u0000b', 'a\u007fb', 'a\tb']) {
      expect(() => validateChannelUpdates({ name: value })).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    }
    expect(() => validateChannelUpdates('not-an-object')).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    expect(() => validateChannelUpdates({ category_id: { evil: true } })).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });

  test('drops fields that are not writable through channel updates', () => {
    const { validateChannelUpdates } = require('../../../src/utils/validation');

    expect(validateChannelUpdates({ name: 'Safe', epg_channel_id: 'foreign', is_admin: true, sort_order: 5 }))
      .toEqual({ name: 'Safe' });
  });

  test('builds timezone-aware date ranges and rejects impossible dates', () => {
    const { start, end } = buildDateRange('2026-07-27', '-180');
    expect(end.getTime() - start.getTime()).toBe(86_400_000);
    expect(start.toISOString()).toBe('2026-07-26T21:00:00.000Z');
    expect(() => buildDateRange('2026-02-31')).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });
});
