const { AppError } = require('../../../src/utils/AppError');

const mockSafeFetchJson = jest.fn();
jest.mock('../../../src/utils/safeFetch', () => ({
  safeFetchJson: (...args) => mockSafeFetchJson(...args),
  parseRemoteUrl: (value) => new URL(value),
}));

const XtreamClient = require('../../../src/services/XtreamClient');

describe('XtreamClient', () => {
  beforeEach(() => mockSafeFetchJson.mockReset());

  test('normalizes and validates the server URL', () => {
    expect(new XtreamClient('https://example.com///', 'u', 'p').serverUrl).toBe('https://example.com');
    expect(() => new XtreamClient('not-a-url', 'u', 'p')).toThrow();
  });

  test('authenticates through the SSRF-safe JSON client', async () => {
    mockSafeFetchJson.mockResolvedValue({ data: { user_info: { auth: 1 }, server_info: { url: 'example.com' } } });
    const client = new XtreamClient('https://example.com', 'user name', 'p&ss', { maxRetries: 1 });

    await expect(client.authenticate()).resolves.toEqual({ serverInfo: { url: 'example.com' } });
    const [url, options] = mockSafeFetchJson.mock.calls[0];
    expect(url).toContain('username=user+name');
    expect(url).toContain('password=p%26ss');
    expect(options).toEqual(expect.objectContaining({ timeoutMs: expect.any(Number), maxBytes: expect.any(Number) }));
  });

  test.each([
    [{}, 'XTREAM_AUTH_FAILED'],
    [{ user_info: { auth: 0 }, server_info: {} }, 'XTREAM_AUTH_FAILED'],
  ])('rejects invalid authentication payloads', async (data, code) => {
    mockSafeFetchJson.mockResolvedValue({ data });
    const client = new XtreamClient('https://example.com', 'u', 'p', { maxRetries: 1 });
    await expect(client.authenticate()).rejects.toMatchObject({ code });
  });

  test('retries transient failures and then succeeds', async () => {
    mockSafeFetchJson
      .mockRejectedValueOnce(new Error('reset'))
      .mockResolvedValueOnce({ data: [{ category_id: '1', category_name: 'News' }] });
    const client = new XtreamClient('https://example.com', 'u', 'p', { maxRetries: 2, baseDelay: 0 });

    await expect(client.getLiveCategories()).resolves.toHaveLength(1);
    expect(mockSafeFetchJson).toHaveBeenCalledTimes(2);
  });

  test('wraps an exhausted connection failure', async () => {
    mockSafeFetchJson.mockRejectedValue(new Error('connection refused'));
    const client = new XtreamClient('https://example.com', 'u', 'p', { maxRetries: 2, baseDelay: 0 });

    await expect(client.authenticate()).rejects.toEqual(expect.objectContaining({
      code: 'XTREAM_CONNECTION_FAILED',
    }));
    expect(mockSafeFetchJson).toHaveBeenCalledTimes(2);
  });

  test('maps live, VOD and series data into stable channel records', async () => {
    const client = new XtreamClient('https://example.com', 'u', 'p');
    jest.spyOn(client, 'getLiveCategories').mockResolvedValue([{ category_id: '1', category_name: 'Live' }]);
    jest.spyOn(client, 'getLiveStreams').mockResolvedValue([{ stream_id: 10, name: 'Live One', category_id: '1' }]);
    jest.spyOn(client, 'getVodCategories').mockResolvedValue([{ category_id: '2', category_name: 'Films' }]);
    jest.spyOn(client, 'getVodStreams').mockResolvedValue([{ stream_id: 20, name: 'Film', category_id: '2', container_extension: 'mkv' }]);
    jest.spyOn(client, 'getSeriesCategories').mockResolvedValue([{ category_id: '3', category_name: 'Shows' }]);
    jest.spyOn(client, 'getSeriesStreams').mockResolvedValue([{ series_id: 30, name: 'Show', category_id: '3' }]);

    const result = await client.getAllChannels(['live', 'vod', 'series']);
    expect(result.channels.map((item) => item.stream_type)).toEqual(['live', 'vod', 'series']);
    expect(result.categories.map((item) => item.category_id)).toEqual(['1', 'vod_2', 'series_3']);
  });

  test('uses one bulk stream request when it covers every category', async () => {
    const client = new XtreamClient('https://example.com', 'u', 'p');
    const categories = Array.from({ length: 100 }, (_, index) => ({
      category_id: String(index),
      category_name: `Category ${index}`,
    }));
    jest.spyOn(client, 'getLiveCategories').mockResolvedValue(categories);
    const getStreams = jest.spyOn(client, 'getLiveStreams').mockResolvedValue(
      categories.map((category, index) => ({ stream_id: index, name: `Channel ${index}`, category_id: category.category_id }))
    );

    const result = await client.getAllChannels(['live']);

    expect(result.channels).toHaveLength(100);
    expect(getStreams).toHaveBeenCalledTimes(1);
    expect(getStreams).toHaveBeenCalledWith(undefined);
  });

  test('fetches only missing categories concurrently when a bulk response is incomplete', async () => {
    const client = new XtreamClient('https://example.com', 'u', 'p');
    jest.spyOn(client, 'getLiveCategories').mockResolvedValue([
      { category_id: '1', category_name: 'One' },
      { category_id: '2', category_name: 'Two' },
      { category_id: '3', category_name: 'Three' },
    ]);
    let active = 0;
    let maxActive = 0;
    const getStreams = jest.spyOn(client, 'getLiveStreams').mockImplementation(async (categoryId) => {
      if (categoryId === undefined) return [{ stream_id: 1, name: 'One', category_id: '1' }];
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setImmediate(resolve));
      active -= 1;
      return [{ stream_id: Number(categoryId), name: categoryId, category_id: categoryId }];
    });

    const result = await client.getAllChannels(['live']);

    expect(result.channels).toHaveLength(3);
    expect(getStreams.mock.calls.map(([categoryId]) => categoryId)).toEqual([undefined, '2', '3']);
    expect(maxActive).toBe(2);
  });

  test('rejects an incomplete category fallback instead of deleting unseen provider data', async () => {
    const client = new XtreamClient('https://example.com', 'u', 'p');
    jest.spyOn(client, 'getLiveCategories').mockResolvedValue([
      { category_id: '1', category_name: 'One' },
      { category_id: '2', category_name: 'Two' },
    ]);
    jest.spyOn(client, 'getLiveStreams').mockImplementation(async (categoryId) => {
      if (categoryId === undefined) throw new Error('bulk unavailable');
      if (categoryId === '2') throw new Error('category unavailable');
      return [{ stream_id: 1, name: 'One', category_id: '1' }];
    });

    await expect(client.getAllChannels(['live'])).rejects.toThrow('category unavailable');
  });

  test('loads content types with bounded parallelism while preserving result order', async () => {
    const client = new XtreamClient('https://example.com', 'u', 'p');
    let active = 0;
    let maxActive = 0;
    const loader = (type) => async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setImmediate(resolve));
      active -= 1;
      return {
        categories: [{ category_id: type, category_name: type }],
        channels: [{ stream_id: type, stream_type: type }],
      };
    };
    jest.spyOn(client, '_getLivePayload').mockImplementation(loader('live'));
    jest.spyOn(client, '_getVodPayload').mockImplementation(loader('vod'));
    jest.spyOn(client, '_getSeriesPayload').mockImplementation(loader('series'));

    const result = await client.getAllChannels(['live', 'vod', 'series']);

    expect(maxActive).toBe(2);
    expect(result.channels.map((channel) => channel.stream_type)).toEqual(['live', 'vod', 'series']);
  });

  test('encodes credentials and identifiers in generated URLs', () => {
    const client = new XtreamClient('https://example.com', 'a/b', 'p@ss', { maxRetries: 1 });
    expect(client.getXmltvUrl()).toContain('username=a%2Fb');
    expect(client.buildStreamUrl('vod', '1/2', 'mkv')).toBe('https://example.com/movie/a%2Fb/p%40ss/1%2F2.mkv');
  });

  test('uses AppError for connection failures', async () => {
    mockSafeFetchJson.mockRejectedValue(new Error('offline'));
    await expect(new XtreamClient('https://example.com', 'u', 'p', { maxRetries: 1 }).authenticate())
      .rejects.toBeInstanceOf(AppError);
  });
});
