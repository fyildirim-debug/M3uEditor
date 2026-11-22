const TtlCache = require('../../../src/utils/TtlCache');

describe('TtlCache', () => {
  test('serves a cached value until it expires', async () => {
    const cache = new TtlCache({ ttlMs: 50 });
    const loader = jest.fn().mockResolvedValue('v1');
    expect(await cache.wrap('k', loader)).toBe('v1');
    expect(await cache.wrap('k', loader)).toBe('v1');
    expect(loader).toHaveBeenCalledTimes(1);

    await new Promise((resolve) => { setTimeout(resolve, 60); });
    loader.mockResolvedValue('v2');
    expect(await cache.wrap('k', loader)).toBe('v2');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  test('parallel callers share one in-flight load', async () => {
    const cache = new TtlCache();
    let release;
    const loader = jest.fn(() => new Promise((resolve) => { release = resolve; }));
    const both = Promise.all([cache.wrap('k', loader), cache.wrap('k', loader)]);
    release('ok');
    expect(await both).toEqual(['ok', 'ok']);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  test('failures are not cached', async () => {
    const cache = new TtlCache();
    await expect(cache.wrap('k', () => Promise.reject(new Error('down')))).rejects.toThrow('down');
    expect(await cache.wrap('k', async () => 'ok')).toBe('ok');
  });

  test('evicts the least recently used entry beyond the limit', () => {
    const cache = new TtlCache({ maxEntries: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
  });
});
