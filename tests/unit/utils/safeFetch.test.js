const http = require('http');
const { Duplex, PassThrough } = require('stream');
const { requestBuffer } = require('../../../src/utils/safeFetch');

/**
 * safeFetch normalde ozel/ayrilmis adresleri reddeder. Bu testler loopback
 * uzerinde calistigi icin bayrak acilir; her test sonunda geri alinir.
 */
const config = require('../../../src/config');

let server;
let baseUrl;
let previousAllowPrivate;
let originalRequest;
let inMemoryAgent;

function decorateSocket(socket) {
  socket.setTimeout = (_timeout, callback) => {
    if (callback) socket.once('timeout', callback);
    return socket;
  };
  socket.setNoDelay = () => socket;
  socket.setKeepAlive = () => socket;
  socket.address = () => ({ address: '127.0.0.1', family: 'IPv4', port: 80 });
  return socket;
}

function connectInMemory(targetServer) {
  const clientToServer = new PassThrough();
  const serverToClient = new PassThrough();
  const clientSocket = decorateSocket(Duplex.from({ readable: serverToClient, writable: clientToServer }));
  const serverSocket = decorateSocket(Duplex.from({ readable: clientToServer, writable: serverToClient }));
  process.nextTick(() => targetServer.emit('connection', serverSocket));
  return clientSocket;
}

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

  originalRequest = http.request;
  inMemoryAgent = new http.Agent({ keepAlive: false });
  inMemoryAgent.createConnection = () => connectInMemory(server);
  http.request = (url, options = {}) => originalRequest({
    host: '127.0.0.1',
    port: 80,
    path: `${url.pathname}${url.search}`,
    method: options.method || 'GET',
    headers: options.headers,
    agent: inMemoryAgent,
  });
  baseUrl = 'http://127.0.0.1';
});

afterAll(() => {
  config.allowPrivateNetworkUrls = previousAllowPrivate;
  http.request = originalRequest;
  inMemoryAgent.destroy();
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
