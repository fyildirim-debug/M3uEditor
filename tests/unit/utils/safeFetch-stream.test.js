const { EventEmitter } = require('events');
const { Readable } = require('stream');

const mockRequest = jest.fn();
const mockLookup = jest.fn();
jest.mock('http', () => ({ request: (...args) => mockRequest(...args) }));
jest.mock('https', () => ({ request: (...args) => mockRequest(...args) }));
jest.mock('dns', () => ({ promises: { lookup: (...args) => mockLookup(...args) } }));

const { requestBuffer, requestStream } = require('../../../src/utils/safeFetch');

function queueResponse({ statusCode = 200, headers = {}, chunks = [] } = {}) {
  mockRequest.mockImplementationOnce(() => {
    const request = new EventEmitter();
    request.destroy = jest.fn((error) => process.nextTick(() => request.emit('error', error)));
    request.end = jest.fn(() => {
      const response = Readable.from(chunks);
      response.statusCode = statusCode;
      response.headers = headers;
      process.nextTick(() => request.emit('response', response));
    });
    return request;
  });
}

function queueDelayedResponse(delayMs, { statusCode = 200, headers = {}, chunks = [] } = {}) {
  mockRequest.mockImplementationOnce(() => {
    const request = new EventEmitter();
    let responseTimer;
    request.destroy = jest.fn((error) => {
      clearTimeout(responseTimer);
      process.nextTick(() => request.emit('error', error));
    });
    request.end = jest.fn(() => {
      responseTimer = setTimeout(() => {
        const response = Readable.from(chunks);
        response.statusCode = statusCode;
        response.headers = headers;
        request.emit('response', response);
      }, delayMs);
    });
    return request;
  });
}

async function readAll(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

describe('requestStream', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  });

  test('returns a readable body without constructing a full response buffer', async () => {
    queueResponse({ chunks: [Buffer.from('first'), Buffer.from('-second')] });

    const response = await requestStream('https://example.com/guide.xml', { maxBytes: 1024 });

    expect(response.buffer).toBeUndefined();
    await expect(readAll(response.stream)).resolves.toEqual(Buffer.from('first-second'));
  });

  test('enforces the byte ceiling while a chunked body is consumed', async () => {
    queueResponse({ chunks: [Buffer.alloc(700), Buffer.alloc(700)] });

    const response = await requestStream('https://example.com/guide.xml', { maxBytes: 1024 });

    await expect(readAll(response.stream)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  test('revalidates DNS and pins the lookup after a redirect', async () => {
    queueResponse({ statusCode: 302, headers: { location: 'https://cdn.example.net/guide.xml' } });
    queueResponse({ chunks: [Buffer.from('<tv></tv>')] });

    const response = await requestStream('https://example.com/start');

    await expect(readAll(response.stream)).resolves.toEqual(Buffer.from('<tv></tv>'));
    expect(mockLookup).toHaveBeenCalledTimes(2);
    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest.mock.calls[0][1].lookup).toEqual(expect.any(Function));
    expect(mockRequest.mock.calls[1][1].lookup).toEqual(expect.any(Function));
  });

  test('uses one absolute deadline across delayed redirects', async () => {
    queueDelayedResponse(60, { statusCode: 302, headers: { location: 'https://cdn.example.net/data' } });
    queueDelayedResponse(60, { chunks: [Buffer.from('too late')] });

    const startedAt = Date.now();
    await expect(requestBuffer('https://example.com/start', { timeoutMs: 80, maxBytes: 1024 }))
      .rejects.toMatchObject({ code: 'XTREAM_CONNECTION_FAILED', budgetExhausted: true, budgetType: 'deadline' });

    expect(Date.now() - startedAt).toBeLessThan(120);
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });

  test('shares an explicit byte counter across buffer requests', async () => {
    const byteBudget = { remaining: 1000 };
    queueResponse({ chunks: [Buffer.alloc(600)] });
    queueResponse({ chunks: [Buffer.alloc(401)] });

    await expect(requestBuffer('https://example.com/first', { byteBudget, maxBytes: 1000 }))
      .resolves.toMatchObject({ buffer: expect.any(Buffer) });
    expect(byteBudget.remaining).toBe(400);
    await expect(requestBuffer('https://example.com/second', { byteBudget, maxBytes: 1000 }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR', budgetExhausted: true, budgetType: 'bytes' });
    expect(byteBudget.remaining).toBe(0);
  });
});
