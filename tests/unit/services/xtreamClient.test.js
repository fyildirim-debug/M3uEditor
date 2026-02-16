const { AppError } = require('../../../src/utils/AppError');
const XtreamClient = require('../../../src/services/XtreamClient');

// Mock global fetch
const originalFetch = global.fetch;

function mockFetchResponse(body, ok = true, status = 200) {
  return jest.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

function mockFetchReject(error) {
  return jest.fn().mockRejectedValue(error);
}

describe('XtreamClient', () => {
  let client;

  beforeEach(() => {
    client = new XtreamClient('http://xtream.example.com/', 'testuser', 'testpass', { baseDelay: 0 });
    jest.useFakeTimers({ advanceTimers: true });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should normalize serverUrl by removing trailing slash', () => {
      const c = new XtreamClient('http://example.com///', 'u', 'p');
      expect(c.serverUrl).toBe('http://example.com');
    });

    it('should store credentials', () => {
      expect(client.username).toBe('testuser');
      expect(client.password).toBe('testpass');
    });
  });

  describe('authenticate', () => {
    it('should return serverInfo on valid credentials', async () => {
      const apiResponse = {
        user_info: { auth: 1, username: 'testuser', status: 'Active' },
        server_info: { url: 'xtream.example.com', port: '80' },
      };
      global.fetch = mockFetchResponse(apiResponse);

      const result = await client.authenticate();

      expect(result).toEqual({ serverInfo: { url: 'xtream.example.com', port: '80' } });
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const calledUrl = global.fetch.mock.calls[0][0];
      expect(calledUrl).toContain('player_api.php');
      expect(calledUrl).toContain('username=testuser');
      expect(calledUrl).toContain('password=testpass');
    });

    it('should throw XTREAM_AUTH_FAILED when response has no user_info', async () => {
      global.fetch = mockFetchResponse({ some: 'data' });

      await expect(client.authenticate()).rejects.toThrow(AppError);
      try {
        await client.authenticate();
      } catch (err) {
        expect(err.code).toBe('XTREAM_AUTH_FAILED');
      }
    });

    it('should throw XTREAM_AUTH_FAILED when auth is 0', async () => {
      global.fetch = mockFetchResponse({
        user_info: { auth: 0 },
        server_info: {},
      });

      await expect(client.authenticate()).rejects.toThrow(AppError);
      try {
        await client.authenticate();
      } catch (err) {
        expect(err.code).toBe('XTREAM_AUTH_FAILED');
      }
    });

    it('should throw XTREAM_CONNECTION_FAILED when server is unreachable', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      global.fetch = mockFetchReject(abortError);

      try {
        await client.authenticate();
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect(err.code).toBe('XTREAM_CONNECTION_FAILED');
      }
    });

    it('should throw XTREAM_CONNECTION_FAILED on network error', async () => {
      global.fetch = mockFetchReject(new Error('Network error'));

      try {
        await client.authenticate();
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect(err.code).toBe('XTREAM_CONNECTION_FAILED');
      }
    });
  });

  describe('getLiveCategories', () => {
    it('should return categories array', async () => {
      const categories = [
        { category_id: '1', category_name: 'Sports' },
        { category_id: '2', category_name: 'News' },
      ];
      global.fetch = mockFetchResponse(categories);

      const result = await client.getLiveCategories();

      expect(result).toEqual(categories);
      const calledUrl = global.fetch.mock.calls[0][0];
      expect(calledUrl).toContain('action=get_live_categories');
    });

    it('should return empty array when response is not an array', async () => {
      global.fetch = mockFetchResponse({ error: 'something' });

      const result = await client.getLiveCategories();

      expect(result).toEqual([]);
    });
  });

  describe('getLiveStreams', () => {
    it('should return streams array', async () => {
      const streams = [
        { stream_id: '101', name: 'Channel 1', stream_icon: 'icon.png', epg_channel_id: 'ch1', category_id: '1' },
        { stream_id: '102', name: 'Channel 2', stream_icon: '', epg_channel_id: '', category_id: '2' },
      ];
      global.fetch = mockFetchResponse(streams);

      const result = await client.getLiveStreams();

      expect(result).toEqual(streams);
      const calledUrl = global.fetch.mock.calls[0][0];
      expect(calledUrl).toContain('action=get_live_streams');
      expect(calledUrl).not.toContain('category_id');
    });

    it('should include category_id param when provided', async () => {
      global.fetch = mockFetchResponse([]);

      await client.getLiveStreams('5');

      const calledUrl = global.fetch.mock.calls[0][0];
      expect(calledUrl).toContain('category_id=5');
    });

    it('should return empty array when response is not an array', async () => {
      global.fetch = mockFetchResponse(null);

      const result = await client.getLiveStreams();

      expect(result).toEqual([]);
    });
  });

  describe('getAllChannels', () => {
    it('should combine categories and streams in parallel', async () => {
      const categories = [
        { category_id: '1', category_name: 'Sports' },
      ];
      const streams = [
        { stream_id: '101', name: 'ESPN', stream_icon: 'espn.png', epg_channel_id: 'espn.us', category_id: '1' },
        { stream_id: '102', name: 'BBC', stream_icon: '', epg_channel_id: '', category_id: '1' },
      ];

      // First call returns categories, second returns streams
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(categories) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(streams) });

      const result = await client.getAllChannels();

      expect(result.categories).toEqual([
        { category_id: '1', category_name: 'Sports' },
      ]);
      expect(result.channels).toEqual([
        { stream_id: '101', name: 'ESPN', stream_icon: 'espn.png', epg_channel_id: 'espn.us', category_id: '1' },
        { stream_id: '102', name: 'BBC', stream_icon: null, epg_channel_id: null, category_id: '1' },
      ]);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle null/missing fields in streams', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve([]) })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve([
            { stream_id: '1', name: 'Test' },
          ]),
        });

      const result = await client.getAllChannels();

      expect(result.channels[0]).toEqual({
        stream_id: '1',
        name: 'Test',
        stream_icon: null,
        epg_channel_id: null,
        category_id: null,
      });
    });
  });

  describe('retry logic', () => {
    it('should retry on transient failures and succeed', async () => {
      const networkError = new Error('ECONNRESET');
      const successResponse = {
        user_info: { auth: 1 },
        server_info: { url: 'test.com' },
      };

      global.fetch = jest.fn()
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(successResponse),
        });

      const result = await client.authenticate();

      expect(result).toEqual({ serverInfo: { url: 'test.com' } });
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should fail after 3 retries exhausted', async () => {
      const networkError = new Error('ECONNREFUSED');
      global.fetch = mockFetchReject(networkError);

      try {
        await client.authenticate();
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect(err.code).toBe('XTREAM_CONNECTION_FAILED');
      }
      // 3 attempts total
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should retry on HTTP error responses', async () => {
      const successResponse = [{ category_id: '1', category_name: 'Test' }];

      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(successResponse) });

      const result = await client.getLiveCategories();

      expect(result).toEqual(successResponse);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should use exponential backoff delays', async () => {
      // Use a client with real delays to test backoff timing
      const clientWithDelay = new XtreamClient('http://test.com', 'u', 'p', { baseDelay: 1000 });
      const networkError = new Error('fail');
      const successResponse = {
        user_info: { auth: 1 },
        server_info: { url: 'test.com' },
      };

      global.fetch = jest.fn()
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(successResponse),
        });

      const promise = clientWithDelay.authenticate();

      // Advance through retry delays (1s, 2s)
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);

      const result = await promise;
      expect(result).toEqual({ serverInfo: { url: 'test.com' } });
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });
});
