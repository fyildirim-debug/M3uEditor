const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const jwtConfig = require('../../../src/config/jwt');
const { AppError } = require('../../../src/utils/AppError');
const { hashToken } = require('../../../src/utils/crypto');

// --- Mock the database module ---
const mockKnex = jest.fn();
mockKnex.fn = { now: jest.fn(() => 'NOW') };
jest.mock('../../../src/config/database', () => mockKnex);
const mockRemoveChannelLogos = jest.fn().mockResolvedValue();
jest.mock('../../../src/utils/logoStorage', () => ({ removeChannelLogos: mockRemoveChannelLogos }));

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

      mockKnex.mockImplementation((table) => ({
        insert: jest.fn().mockImplementation((data) => {
          if (table === 'users') insertedData = data;
          return { returning: jest.fn().mockResolvedValue([
            table === 'users' ? fakeUser : { id: 'session-uuid-2', user_id: fakeUser.id },
          ]) };
        }),
      }));

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

      mockKnex.mockImplementation((table) => table === 'users' ? {
        where: jest.fn().mockReturnValue({ first: jest.fn().mockResolvedValue(fakeUser) }),
      } : {
        insert: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([{ id: 'session-uuid-3', user_id: fakeUser.id }]) }),
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
      const compareSpy = jest.spyOn(bcrypt, 'compare');
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
        expect(compareSpy).toHaveBeenCalledWith('anypass', expect.stringMatching(/^\$2[aby]\$/));
        compareSpy.mockRestore();
      }
    });
  });

  describe('forgotPassword', () => {
    it('does equivalent token generation for an unknown email', async () => {
      const randomBytesSpy = jest.spyOn(crypto, 'randomBytes');
      mockKnex.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(0),
      });

      await expect(authService.forgotPassword('missing@example.com')).resolves.toEqual({ success: true });

      expect(randomBytesSpy).toHaveBeenCalledWith(32);
      randomBytesSpy.mockRestore();
    });

    it('starts password reset email delivery without awaiting SMTP', async () => {
      const fakeUser = { id: 'forgot-user-1', email: 'forgot@example.com' };
      const query = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(fakeUser),
        update: jest.fn().mockResolvedValue(1),
      };
      mockKnex.mockReturnValue(query);
      const emailService = require('../../../src/services/EmailService');
      const pendingDelivery = {
        catch: jest.fn(),
        then: jest.fn(() => { throw new Error('E-posta gönderimi await edilmemeli'); }),
      };
      const sendSpy = jest.spyOn(emailService, 'sendPasswordReset').mockReturnValue(pendingDelivery);

      await expect(authService.forgotPassword(fakeUser.email)).resolves.toEqual({ success: true });

      expect(sendSpy).not.toHaveBeenCalled();
      await new Promise((resolve) => setImmediate(resolve));
      expect(sendSpy).toHaveBeenCalledWith(fakeUser.email, expect.any(String));
      expect(pendingDelivery.catch).toHaveBeenCalledTimes(1);
      expect(pendingDelivery.then).not.toHaveBeenCalled();
      sendSpy.mockRestore();
    });
  });

  describe('deleteAccount', () => {
    function mockAccountDeletion(channelBatches, events = []) {
      const passwordHash = bcrypt.hashSync('correct-password', 4);
      mockKnex.mockImplementation((table) => {
        if (table !== 'users') throw new Error(`Unexpected table outside transaction: ${table}`);
        return { where: jest.fn().mockReturnThis(), first: jest.fn().mockResolvedValue({ id: 'user-1', password_hash: passwordHash }) };
      });

      const batches = [...channelBatches, []];
      const trx = jest.fn((table) => {
        if (table === 'channels') {
          const query = {};
          for (const method of ['join', 'where', 'select', 'orderBy', 'limit', 'andWhere']) query[method] = jest.fn(() => query);
          query.then = (resolve, reject) => Promise.resolve(batches.shift()).then(resolve, reject);
          return query;
        }
        if (table === 'playlists') {
          const query = { where: jest.fn(), select: jest.fn(), forUpdate: jest.fn() };
          query.where.mockReturnValue(query);
          query.select.mockReturnValue(query);
          query.forUpdate.mockResolvedValue([]);
          return query;
        }
        const query = { where: jest.fn(), forUpdate: jest.fn(), first: jest.fn(), del: jest.fn() };
        query.where.mockReturnValue(query);
        query.forUpdate.mockReturnValue(query);
        query.first.mockResolvedValue({ id: 'user-1' });
        query.del.mockResolvedValue(1);
        return query;
      });
      mockKnex.transaction = jest.fn(async (callback) => {
        const result = await callback(trx);
        events.push('commit');
        return result;
      });
      return trx;
    }

    it('spools channel ids in bounded batches and cleans logos after commit', async () => {
      const events = [];
      const firstBatch = Array.from({ length: 1000 }, (_, index) => ({ id: `channel-${String(index).padStart(4, '0')}` }));
      mockAccountDeletion([firstBatch, [{ id: 'channel-1000' }]], events);
      mockRemoveChannelLogos.mockImplementation(async (ids) => events.push(`remove:${ids.length}`));

      await expect(authService.deleteAccount('user-1', 'correct-password')).resolves.toEqual({ success: true });

      expect(events).toEqual(['commit', 'remove:1000', 'remove:1']);
    });

    it('keeps account logos when the delete transaction rolls back', async () => {
      mockAccountDeletion([]);
      mockKnex.transaction.mockRejectedValueOnce(new Error('rollback'));

      await expect(authService.deleteAccount('user-1', 'correct-password')).rejects.toThrow('rollback');

      expect(mockRemoveChannelLogos).not.toHaveBeenCalled();
    });
  });

  describe('refreshAccessToken', () => {
    function createRefreshStore(rawToken = 'parent-refresh-token') {
      const user = { id: 'refresh-user-1', email: 'refresh@example.com' };
      const sessions = [{
        id: 'parent-session-1',
        user_id: user.id,
        family_id: 'parent-session-1',
        token_hash: hashToken(rawToken),
        expires_at: new Date(Date.now() + 60_000),
        revoked_at: null,
        replaced_by_id: null,
        revoke_reason: null,
      }];

      function matches(row, filters) {
        return filters.every((filter) => Object.entries(filter).every(([key, value]) => row[key] === value));
      }

      const trx = jest.fn((table) => {
        const filters = [];
        const query = {
          where(filter) {
            filters.push(filter);
            return query;
          },
          forUpdate() {
            return query;
          },
          async first() {
            const rows = table === 'sessions' ? sessions : [user];
            const row = rows.find((candidate) => matches(candidate, filters));
            return row ? { ...row } : undefined;
          },
          async update(changes) {
            const rows = table === 'sessions' ? sessions : [user];
            const matchingRows = rows.filter((candidate) => matches(candidate, filters));
            matchingRows.forEach((row) => Object.assign(row, changes));
            return matchingRows.length;
          },
          insert(data) {
            return {
              returning: jest.fn(async (columns) => {
                sessions.push({ ...data, revoked_at: null, replaced_by_id: null, revoke_reason: null });
                return [Object.fromEntries(columns.map((column) => [column, data[column]]))];
              }),
            };
          },
        };
        return query;
      });
      trx.fn = { now: jest.fn(() => new Date()) };

      let transactionTail = Promise.resolve();
      mockKnex.transaction = jest.fn((callback) => {
        const result = transactionTail.then(() => callback(trx));
        transactionTail = result.catch(() => undefined);
        return result;
      });

      return { rawToken, sessions };
    }

    it('rotates normally and keeps the new session in the same family', async () => {
      const store = createRefreshStore();

      const result = await authService.refreshAccessToken(store.rawToken);

      expect(result.refreshToken).not.toBe(store.rawToken);
      expect(store.sessions).toHaveLength(2);
      expect(store.sessions[0]).toMatchObject({
        revoked_at: expect.any(Date),
        replaced_by_id: store.sessions[1].id,
        revoke_reason: 'rotated',
      });
      expect(store.sessions[1].family_id).toBe(store.sessions[0].family_id);
    });

    it('serializes concurrent rotation and treats the second use as reuse', async () => {
      const store = createRefreshStore();

      const results = await Promise.allSettled([
        authService.refreshAccessToken(store.rawToken),
        authService.refreshAccessToken(store.rawToken),
      ]);

      expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find(({ status }) => status === 'rejected');
      expect(rejected.reason).toMatchObject({ code: 'INVALID_CREDENTIALS' });
      expect(store.sessions.filter(({ revoked_at }) => !revoked_at)).toHaveLength(0);
      expect(store.sessions[1].revoke_reason).toBe('reuse');
    });

    it('revokes all active descendants when a stolen parent is reused', async () => {
      const store = createRefreshStore();
      await authService.refreshAccessToken(store.rawToken);

      await expect(authService.refreshAccessToken(store.rawToken)).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });

      expect(store.sessions[1]).toMatchObject({ revoked_at: expect.any(Date), revoke_reason: 'reuse' });
      expect(store.sessions.some(({ revoked_at }) => revoked_at === null)).toBe(false);
    });
  });

  describe('verifyToken', () => {
    const signAccessToken = (payload = {}, options = {}) => jwt.sign(
      { userId: 'user-uuid-5', sid: 'session-uuid-5', ...payload },
      jwtConfig.secret,
      {
        expiresIn: '1h',
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
        ...options,
      }
    );

    it('should return userId and sessionId for a valid token', () => {
      const token = signAccessToken();

      const result = authService.verifyToken(token);

      expect(result).toEqual({ userId: 'user-uuid-5', sessionId: 'session-uuid-5' });
    });

    it('should throw TOKEN_EXPIRED for an expired token', () => {
      const token = signAccessToken({ userId: 'user-uuid-6' }, { expiresIn: '0s' });

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
      const token = jwt.sign({ userId: 'user-uuid-7', sid: 'session-uuid-7' }, 'wrong-secret', {
        expiresIn: '1h', issuer: jwtConfig.issuer, audience: jwtConfig.audience,
      });

      try {
        authService.verifyToken(token);
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect(err.code).toBe('INVALID_CREDENTIALS');
      }
    });

    test.each([
      ['missing issuer', () => jwt.sign({ userId: 'user-1', sid: 'session-1' }, jwtConfig.secret, { expiresIn: '1h', audience: jwtConfig.audience })],
      ['wrong issuer', () => signAccessToken({}, { issuer: 'wrong-issuer' })],
      ['wrong audience', () => signAccessToken({}, { audience: 'wrong-audience' })],
      ['missing expiration', () => jwt.sign({ userId: 'user-1', sid: 'session-1' }, jwtConfig.secret, { issuer: jwtConfig.issuer, audience: jwtConfig.audience })],
      ['missing session id', () => jwt.sign({ userId: 'user-1' }, jwtConfig.secret, { expiresIn: '1h', issuer: jwtConfig.issuer, audience: jwtConfig.audience })],
      ['numeric user id', () => signAccessToken({ userId: 123 })],
      ['numeric session id', () => signAccessToken({ sid: 123 })],
      ['alg none', () => jwt.sign({ userId: 'user-1', sid: 'session-1', exp: Math.floor(Date.now() / 1000) + 3600, iss: jwtConfig.issuer, aud: jwtConfig.audience }, '', { algorithm: 'none' })],
    ])('rejects %s tokens', (_name, createToken) => {
      expect(() => authService.verifyToken(createToken())).toThrow(expect.objectContaining({ code: 'INVALID_CREDENTIALS' }));
    });
  });

  describe('verifySession', () => {
    it('accepts an active session owned by the token user', async () => {
      const query = { where: jest.fn().mockReturnThis(), first: jest.fn().mockResolvedValue({ id: 'session-1' }) };
      mockKnex.mockReturnValue(query);
      await expect(authService.verifySession('user-1', 'session-1')).resolves.toBeUndefined();
      expect(query.where).toHaveBeenCalledWith({ id: 'session-1', user_id: 'user-1', revoked_at: null });
    });

    it('rejects a revoked, expired, or foreign session', async () => {
      mockKnex.mockReturnValue({ where: jest.fn().mockReturnThis(), first: jest.fn().mockResolvedValue(undefined) });
      await expect(authService.verifySession('user-1', 'session-1')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });
  });
});

describe('authMiddleware', () => {
  const authMiddleware = require('../../../src/middleware/auth');

  function createReq(authHeader) {
    return { headers: { authorization: authHeader } };
  }

  const res = {};

  it('should set req.userId and always validate its session on valid token', async () => {
    mockKnex.mockReturnValue({ where: jest.fn().mockReturnThis(), first: jest.fn().mockResolvedValue({ id: 'mw-session-1' }) });
    const token = jwt.sign({ userId: 'mw-user-1', sid: 'mw-session-1' }, jwtConfig.secret, {
      expiresIn: '1h', issuer: jwtConfig.issuer, audience: jwtConfig.audience,
    });
    const req = createReq(`Bearer ${token}`);
    const next = jest.fn();

    await authMiddleware(req, res, next);

    expect(req.userId).toBe('mw-user-1');
    expect(req.sessionId).toBe('mw-session-1');
    expect(next).toHaveBeenCalledWith();
  });

  it('validates the session claim on newly issued access tokens', async () => {
    mockKnex.mockReturnValue({ where: jest.fn().mockReturnThis(), first: jest.fn().mockResolvedValue({ id: 'session-1' }) });
    const token = jwt.sign({ userId: 'mw-user-1', sid: 'session-1' }, jwtConfig.secret, {
      expiresIn: '1h', issuer: jwtConfig.issuer, audience: jwtConfig.audience,
    });
    const req = createReq(`Bearer ${token}`);
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(req.sessionId).toBe('session-1');
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

  it('should call next with TOKEN_EXPIRED for an expired token', async () => {
    const token = jwt.sign({ userId: 'mw-user-2', sid: 'mw-session-2' }, jwtConfig.secret, {
      expiresIn: '0s', issuer: jwtConfig.issuer, audience: jwtConfig.audience,
    });
    const req = createReq(`Bearer ${token}`);
    const next = jest.fn();

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = next.mock.calls[0][0];
    expect(err.code).toBe('TOKEN_EXPIRED');
  });
});
