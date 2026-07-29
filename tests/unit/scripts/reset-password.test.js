const mockDb = jest.fn();
mockDb.destroy = jest.fn().mockResolvedValue();
jest.mock('../../../src/config/database', () => mockDb);

const mockResetPasswordByEmail = jest.fn();
jest.mock('../../../src/services/AuthService', () => ({ resetPasswordByEmail: mockResetPasswordByEmail }));

const { generatePassword, parseArguments, main } = require('../../../scripts/reset-password');

describe('reset-password CLI arguments', () => {
  test('generates a strong random password when none is supplied', () => {
    const first = parseArguments(['Operator@Example.com']);
    const secondPassword = generatePassword();

    expect(first).toMatchObject({ email: 'operator@example.com', generated: true });
    expect(first.password).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(secondPassword).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(first.password).not.toBe(secondPassword);
  });

  test('accepts an explicit password', () => {
    expect(parseArguments(['operator@example.com', '--password', 'manual-password'])).toEqual({
      email: 'operator@example.com',
      password: 'manual-password',
      generated: false,
    });
  });

  test.each([
    { args: [] },
    { args: ['one@example.com', 'two@example.com'] },
    { args: ['one@example.com', '--password'] },
    { args: ['one@example.com', '--unknown'] },
  ])('rejects invalid arguments: $args', ({ args }) => {
    expect(() => parseArguments(args)).toThrow();
  });
});

describe('reset-password CLI execution', () => {
  let errorSpy;
  let logSpy;
  let originalExitCode;

  beforeEach(() => {
    jest.clearAllMocks();
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
    errorSpy = jest.spyOn(console, 'error').mockImplementation();
    logSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  test('prints usage and exits with code 1 when called without arguments', async () => {
    await main([]);

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Tam olarak bir e-posta'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Kullanım:'));
    expect(mockResetPasswordByEmail).not.toHaveBeenCalled();
  });

  test('reports an unknown user clearly, destroys the connection, and exits with code 1', async () => {
    mockResetPasswordByEmail.mockRejectedValue(new Error('Kullanıcı bulunamadı: missing@example.com'));

    await main(['missing@example.com', '--password', 'new-password-123']);

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith('❌ Şifre sıfırlanamadı: Kullanıcı bulunamadı: missing@example.com');
    expect(mockDb.destroy).toHaveBeenCalledTimes(1);
  });

  test('prints the generated password after a successful reset', async () => {
    mockResetPasswordByEmail.mockResolvedValue({ success: true, email: 'operator@example.com' });

    await main(['operator@example.com']);

    expect(process.exitCode).toBeUndefined();
    expect(mockResetPasswordByEmail).toHaveBeenCalledWith('operator@example.com', expect.stringMatching(/^[A-Za-z0-9_-]{32}$/));
    expect(logSpy).toHaveBeenCalledWith('✅ Şifre sıfırlandı: operator@example.com');
    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/^Yeni şifre: [A-Za-z0-9_-]{32}$/));
    expect(logSpy).toHaveBeenCalledWith('Tüm aktif oturumlar iptal edildi.');
    expect(mockDb.destroy).toHaveBeenCalledTimes(1);
  });
});
