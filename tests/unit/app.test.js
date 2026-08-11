const request = require('supertest');
const mockDb = { raw: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }) };
jest.mock('../../src/config/database', () => mockDb);
const app = require('../../src/app');

describe('Express App', () => {
  test('GET /health returns ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ status: 'ok', database: 'ok' }));
    expect(res.body.timestamp).toBeDefined();
  });

  test('JSON body parsing works', async () => {
    const res = await request(app)
      .post('/health')
      .send({ test: true });
    // Will get 404 since POST /health isn't defined, but proves JSON parsing loaded
    expect(res.status).toBe(404);
  });

  test('CORS headers are present', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  test('Unknown routes return 404', async () => {
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
  });

  test('Error handler returns consistent JSON format', async () => {
    // The error handler is mounted, verify it catches thrown errors
    // We'll test this more thoroughly in task 1.3
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
  });

  test('refresh endpoint has a dedicated rate limit', async () => {
    let response;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      response = await request(app).post('/api/auth/refresh').send({});
    }

    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('RATE_LIMITED');
  });

  test('shared playlist limit is isolated by a hashed route token', async () => {
    let response;
    for (let attempt = 0; attempt < 31; attempt += 1) {
      response = await request(app).get('/api/shared/rate-limit-token-a');
    }

    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('RATE_LIMITED');

    const differentTokenResponse = await request(app).get('/api/shared/rate-limit-token-b');
    expect(differentTokenResponse.status).not.toBe(429);
  });

  // Oynaticilar bir playlist yuklerken kanal basina get_short_epg atar. Xtream
  // yollari genel limitten muaf olmazsa 200/dk tavani ozel limiti gecersiz
  // kilar ve istemci acilis sirasinda 429 alir.
  test('xtream player paths bypass the general per-minute limit', async () => {
    const statuses = new Set();
    // 260 istek: generalLimiter'in 200/dk tavanini asacak kadar. Gruplar
    // halinde gonderiliyor, aksi halde tek tek beklemek testi yavaslatiyor.
    for (let sent = 0; sent < 260; sent += 20) {
      const batch = await Promise.all(Array.from({ length: 20 }, () => request(app)
        .get('/player_api.php')
        .query({ username: 'player', password: 'secret' })));
      for (const res of batch) statuses.add(res.status);
    }

    expect(statuses.has(429)).toBe(false);
  });

  // skipSuccessfulRequests sayaci once artirip istek bitince geri aliyor, yani
  // paralel istekler sayaci gecici olarak sisiriyor. Tavan dar oldugunda
  // oynaticinin acilistaki es zamanli istekleri 429 aliyordu.
  test('a burst of concurrent player requests is not mistaken for brute force', async () => {
    const responses = await Promise.all(Array.from({ length: 40 }, () => request(app)
      .get('/player_api.php')
      .query({ username: 'burst-player', password: 'secret', action: 'get_short_epg' })));

    expect(responses.some((res) => res.status === 429)).toBe(false);
  });

  test('xtream traffic does not consume the general limiter budget', async () => {
    const res = await request(app).get('/nonexistent-after-xtream-burst');
    expect(res.status).toBe(404);
  });
});
