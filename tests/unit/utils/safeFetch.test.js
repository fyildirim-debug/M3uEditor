const http = require('http');
const { requestBuffer } = require('../../../src/utils/safeFetch');

/**
 * safeFetch normalde ozel/ayrilmis adresleri reddeder. Bu testler loopback
 * uzerinde calistigi icin bayrak acilir; her test sonunda geri alinir.
 */
const config = require('../../../src/config');

let server;
let baseUrl;
let previousAllowPrivate;

beforeAll(async () => {
  previousAllowPrivate = config.allowPrivateNetworkUrls;
  config.allowPrivateNetworkUrls = true;

  server = http.createServer((req, res) => {
    if (req.url === '/big-head') {
      // Canli akis: govde yok ama Content-Length gercek kaynak boyutunu bildirir.
      res.writeHead(200, { 'content-type': 'video/mp2t', 'content-length': '52428800' });
      res.end();
      return;
    }
    if (req.url === '/big-body') {
      const body = Buffer.alloc(4096, 0x61);
      res.writeHead(200, { 'content-type': 'text/plain', 'content-length': String(body.length) });
      res.end(body);
      return;
    }
    res.writeHead(404).end();
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  config.allowPrivateNetworkUrls = previousAllowPrivate;
  await new Promise((resolve) => server.close(resolve));
});

describe('requestBuffer', () => {
  test('accepts a HEAD response whose Content-Length exceeds maxBytes', async () => {
    // HEAD yanitinda govde yoktur; Content-Length boyut asimi sayilmamalidir.
    const response = await requestBuffer(`${baseUrl}/big-head`, { method: 'HEAD', maxBytes: 1024, timeoutMs: 5000 });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('video/mp2t');
    expect(response.buffer).toHaveLength(0);
  });

  test('still rejects a GET response that declares more bytes than allowed', async () => {
    await expect(requestBuffer(`${baseUrl}/big-body`, { maxBytes: 1024, timeoutMs: 5000 }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  test('reads a GET response that fits within the byte budget', async () => {
    const response = await requestBuffer(`${baseUrl}/big-body`, { maxBytes: 8192, timeoutMs: 5000 });
    expect(response.buffer).toHaveLength(4096);
  });
});
