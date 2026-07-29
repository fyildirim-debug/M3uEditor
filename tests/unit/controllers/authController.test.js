const request = require('supertest');

// --- Mock the database module before requiring app ---
const mockKnex = jest.fn();
mockKnex.fn = { now: jest.fn(() => new Date()) };
jest.mock('../../../src/config/database', () => mockKnex);

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../../src/config');
const jwtConfig = require('../../../src/config/jwt');
const app = require('../../../src/app');
const authController = require('../../../src/controllers/authController');
const authRouter = require('../../../src/routes/auth');

describe('Auth Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.allowRegistration = true;
    delete mockKnex.transaction;
  });

  afterAll(() => { config.allowRegistration = true; });

  describe('GET /api/auth/registration-status', () => {
    it('is registered as a public GET route with no authentication middleware', () => {
      const layer = authRouter.stack.find(candidate => candidate.route?.path === '/registration-status');

      expect(layer.route.methods).toEqual({ get: true });
      expect(layer.route.stack).toHaveLength(1);
      expect(layer.route.stack[0].handle).toBe(authController.registrationStatus);
    });

    it('returns only allowed=false when registration is disabled and a user exists', async () => {
      config.allowRegistration = false;
      mockKnex.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: 'existing-user' }),
      });

      const res = { json: jest.fn() };
      const next = jest.fn();
      await authController.registrationStatus({}, res, next);

      expect(res.json).toHaveBeenCalledWith({ allowed: false });
      expect(Object.keys(res.json.mock.calls[0][0])).toEqual(['allowed']);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/register', () => {
    it('should return 201 with user and token on successful registration', async () => {
      const fakeUser = { id: 'uuid-1', email: 'new@example.com' };

      mockKnex.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([fakeUser]),
        }),
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'new@example.com', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.user).toEqual({ id: 'uuid-1', email: 'new@example.com' });
      expect(res.body.token).toBeDefined();
    });

    it('should return 400 for invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: '12345' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should return 200 with user and token on successful login', async () => {
      const passwordHash = await bcrypt.hash('correctpass', 10);
      const fakeUser = { id: 'uuid-2', email: 'login@example.com', password_hash: passwordHash };

      mockKnex.mockImplementation((table) => table === 'users' ? {
        where: jest.fn().mockReturnValue({ first: jest.fn().mockResolvedValue(fakeUser) }),
      } : {
        insert: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([{ id: 'session-uuid-2', user_id: fakeUser.id }]) }),
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@example.com', password: 'correctpass' });

      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({ id: 'uuid-2', email: 'login@example.com' });
      expect(res.body.token).toBeDefined();
    });

    it('should return 400 when email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'bad-email', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 for wrong password', async () => {
      const passwordHash = await bcrypt.hash('correctpass', 10);
      const fakeUser = { id: 'uuid-3', email: 'wrong@example.com', password_hash: passwordHash };

      mockKnex.mockReturnValue({
        where: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue(fakeUser),
        }),
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'wrong@example.com', password: 'wrongpass' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('safely ignores malformed percent-encoding in the refresh cookie', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'm3u_refresh=%E0%A4%A')
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('revokes the sid session when no refresh cookie is present', async () => {
      const query = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: 'logout-session-1' }),
        update: jest.fn().mockResolvedValue(1),
      };
      mockKnex.mockReturnValue(query);
      const token = jwt.sign({ userId: 'logout-user-1', sid: 'logout-session-1' }, jwtConfig.secret, {
        algorithm: 'HS256',
        expiresIn: '1h',
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      });

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
      expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ revoke_reason: 'logout' }));
      expect(query.where).toHaveBeenCalledWith({ id: 'logout-session-1', user_id: 'logout-user-1' });
    });

    it('still returns 200 when the matching session disappears during logout', async () => {
      const query = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: 'logout-session-2' }),
        update: jest.fn().mockResolvedValue(0),
      };
      mockKnex.mockReturnValue(query);
      const token = jwt.sign({ userId: 'logout-user-2', sid: 'logout-session-2' }, jwtConfig.secret, {
        algorithm: 'HS256',
        expiresIn: '1h',
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      });

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
    });
  });
});
