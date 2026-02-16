const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const jwtConfig = require('../../../src/config/jwt');
const { AppError } = require('../../../src/utils/AppError');

// --- Mock the database module ---
const mockKnex = jest.fn();
jest.mock('../../../src/config/database', () => mockKnex);

// Require AuthService AFTER mocking database
const authService = require('../../../src/services/AuthService');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should create a user and return a valid token', async () => {
      const fakeUser = { id: 'user-uuid-1', email: 'test@example.com' };

      mockKnex.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([fakeUser]),
        }),
      });

      const result = await authService.register('test@example.com', 'password123');

      expect(result.user).toEqual({ id: 'user-uuid-1', email: 'test@example.com' });
      expect(result.token).toBeDefined();

      const decoded = jwt.verify(result.token, jwtConfig.secret);
      expect(decoded.userId).toBe('user-uuid-1');
    });

    it('should hash the password before storing', async () => {
      const fakeUser = { id: 'user-uuid-2', email: 'hash@example.com' };
      let insertedData = null;

      mockKnex.mockReturnValue({
        insert: jest.fn().mockImplementation((data) => {
          insertedData = data;
          return { returning: jest.fn().mockResolvedValue([fakeUser]) };
        }),
      });

      await authService.register('hash@example.com', 'mypassword');

      expect(insertedData).toBeDefined();
      expect(insertedData.email).toBe('hash@example.com');
      expect(insertedData.password_hash).not.toBe('mypassword');
      const isValid = await bcrypt.compare('mypassword', insertedData.password_hash);
      expect(isValid).toBe(true);
    });
  });

  describe('login', () => {
    it('should return a token for correct credentials', async () => {
      const passwordHash = await bcrypt.hash('correctpass', 10);
      const fakeUser = { id: 'user-uuid-3', email: 'login@example.com', password_hash: passwordHash };

      mockKnex.mockReturnValue({
        where: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue(fakeUser),
        }),
      });

      const result = await authService.login('login@example.com', 'correctpass');

      expect(result.user).toEqual({ id: 'user-uuid-3', email: 'login@example.com' });
      expect(result.token).toBeDefined();

      const decoded = jwt.verify(result.token, jwtConfig.secret);
      expect(decoded.userId).toBe('user-uuid-3');
    });

    it('should throw INVALID_CREDENTIALS for wrong password', async () => {
      const passwordHash = await bcrypt.hash('correctpass', 10);
      const fakeUser = { id: 'user-uuid-4', email: 'wrong@example.com', password_hash: passwordHash };

      mockKnex.mockReturnValue({
        where: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue(fakeUser),
        }),
      });

      try {
        await authService.login('wrong@example.com', 'wrongpass');
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect(err.code).toBe('INVALID_CREDENTIALS');
        expect(err.statusCode).toBe(401);
      }
    });

    it('should throw INVALID_CREDENTIALS for non-existent email', async () => {
      mockKnex.mockReturnValue({
        where: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue(undefined),
        }),
      });

      try {
        await authService.login('noone@example.com', 'anypass');
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect(err.code).toBe('INVALID_CREDENTIALS');
      }
    });
  });

  describe('verifyToken', () => {
    it('should return userId for a valid token', () => {
      const token = jwt.sign({ userId: 'user-uuid-5' }, jwtConfig.secret, { expiresIn: '1h' });

      const result = authService.verifyToken(token);

      expect(result).toEqual({ userId: 'user-uuid-5' });
    });

    it('should throw TOKEN_EXPIRED for an expired token', () => {
      const token = jwt.sign({ userId: 'user-uuid-6' }, jwtConfig.secret, { expiresIn: '0s' });

      try {
        authService.verifyToken(token);
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect(err.code).toBe('TOKEN_EXPIRED');
        expect(err.statusCode).toBe(401);
      }
    });

    it('should throw INVALID_CREDENTIALS for a malformed token', () => {
      try {
        authService.verifyToken('not-a-valid-token');
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect(err.code).toBe('INVALID_CREDENTIALS');
      }
    });

    it('should throw INVALID_CREDENTIALS for a token signed with wrong secret', () => {
      const token = jwt.sign({ userId: 'user-uuid-7' }, 'wrong-secret', { expiresIn: '1h' });

      try {
        authService.verifyToken(token);
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect(err.code).toBe('INVALID_CREDENTIALS');
      }
    });
  });
});

describe('authMiddleware', () => {
  const authMiddleware = require('../../../src/middleware/auth');

  function createReq(authHeader) {
    return { headers: { authorization: authHeader } };
  }

  const res = {};

  it('should set req.userId on valid token', () => {
    const token = jwt.sign({ userId: 'mw-user-1' }, jwtConfig.secret, { expiresIn: '1h' });
    const req = createReq(`Bearer ${token}`);
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(req.userId).toBe('mw-user-1');
    expect(next).toHaveBeenCalledWith();
  });

  it('should call next with error when no Authorization header', () => {
    const req = { headers: {} };
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = next.mock.calls[0][0];
    expect(err.code).toBe('INVALID_CREDENTIALS');
  });

  it('should call next with error when Authorization header has no Bearer prefix', () => {
    const req = createReq('Token abc123');
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = next.mock.calls[0][0];
    expect(err.code).toBe('INVALID_CREDENTIALS');
  });

  it('should call next with error for an invalid token', () => {
    const req = createReq('Bearer invalid-token');
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = next.mock.calls[0][0];
    expect(err.code).toBe('INVALID_CREDENTIALS');
  });

  it('should call next with TOKEN_EXPIRED for an expired token', () => {
    const token = jwt.sign({ userId: 'mw-user-2' }, jwtConfig.secret, { expiresIn: '0s' });
    const req = createReq(`Bearer ${token}`);
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = next.mock.calls[0][0];
    expect(err.code).toBe('TOKEN_EXPIRED');
  });
});
