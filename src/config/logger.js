const pino = require('pino');

// LOG_FILE verilirse gunluk o dosyaya yazilir (masaustu uygulamasi: konsolu
// olmayan bir surecte kullanicinin "gunlugu ac" ile bakabilecegi yer).
const logFile = process.env.LOG_FILE;
const destination = logFile ? pino.destination({ dest: logFile, mkdir: true, sync: false }) : undefined;

module.exports = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : (process.env.LOG_LEVEL || 'info'),
  redact: {
    paths: [
      'req.headers.authorization',
      'authorization',
      'password',
      'refreshToken',
      '*.password',
      '*.refreshToken',
    ],
    censor: '[REDACTED]',
  },
  transport: process.env.NODE_ENV !== 'production' && !logFile
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
    : undefined,
}, destination);
