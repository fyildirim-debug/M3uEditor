const mockDesktopSession = jest.fn();
jest.mock('../../../src/services/AuthService', () => ({
  desktopSession: (...args) => mockDesktopSession(...args),
}));

const mockConfig = { cookieSecure: false, desktopLoginToken: null };
jest.mock('../../../src/config', () => mockConfig);

const { desktopSession } = require('../../../src/controllers/authController');

const TOKEN = 'a'.repeat(64);

function call({ remoteAddress = '127.0.0.1', token } = {}) {
  const req = {
    socket: { remoteAddress },
    ip: remoteAddress,
    get: (name) => (name.toLowerCase() === 'x-desktop-token' ? token : name.toLowerCase() === 'user-agent' ? 'test' : undefined),
  };
  const res = { cookie: jest.fn(), json: jest.fn() };
  const next = jest.fn();
  return desktopSession(req, res, next).then(() => ({ res, next }));
}

describe('desktop local session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig.desktopLoginToken = TOKEN;
    mockDesktopSession.mockResolvedValue({ user: { id: 'u1' }, token: 'access', refreshToken: 'refresh' });
  });

  test('does not exist on a server installation', async () => {
    mockConfig.desktopLoginToken = null;
    const { next } = await call({ token: TOKEN });
    expect(next.mock.calls[0][0].statusCode).toBe(404);
    expect(mockDesktopSession).not.toHaveBeenCalled();
  });

  test('rejects a wrong token', async () => {
    const { next } = await call({ token: 'b'.repeat(64) });
    expect(next.mock.calls[0][0].statusCode).toBe(403);
    expect(mockDesktopSession).not.toHaveBeenCalled();
  });

  test('rejects a request that does not come from this machine', async () => {
    const { next } = await call({ token: TOKEN, remoteAddress: '192.168.1.20' });
    expect(next.mock.calls[0][0].statusCode).toBe(403);
    expect(mockDesktopSession).not.toHaveBeenCalled();
  });

  test('opens a session for the local user and sets the refresh cookie', async () => {
    const { res, next } = await call({ token: TOKEN, remoteAddress: '::ffff:127.0.0.1' });
    expect(next).not.toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledWith('m3u_refresh', 'refresh', expect.objectContaining({ httpOnly: true, path: '/api/auth' }));
    expect(res.json).toHaveBeenCalledWith({ user: { id: 'u1' }, token: 'access' });
  });
});
