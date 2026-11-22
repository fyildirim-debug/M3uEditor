/**
 * Arka uc sureci (Electron utilityProcess).
 *
 * Pencereden ayri bir surecte calisir: buyuk bir Xtream katalogunu islemek
 * gibi agir isler arayuzu dondurmaz, bu surec coksede pencere acik kalir ve
 * kullaniciya anlasilir bir hata gosterilir.
 *
 * Ana surecle mesajlasma:
 *   ana  -> { type: 'start', config }   ayarlari verip baslatir
 *   bu   -> { type: 'status', stage }   ilerleme (acilis ekrani icin)
 *   bu   -> { type: 'ready', url }      arayuz bu adreste
 *   bu   -> { type: 'fatal', stage, message }
 *   ana  -> { type: 'shutdown' }        duzgun kapanis
 *   bu   -> { type: 'stopped' }
 */
const fs = require('fs');
const path = require('path');
const { LocalPostgres } = require('./postgres');

const parent = process.parentPort;
let postgres = null;
let server = null;
let stopping = false;
let pgLog = null;

function send(message) {
  parent?.postMessage(message);
}

function openPgLog(logDir) {
  fs.mkdirSync(logDir, { recursive: true });
  const stream = fs.createWriteStream(path.join(logDir, 'postgres.log'), { flags: 'a' });
  return (line) => {
    if (line) stream.write(`[${new Date().toISOString()}] ${line}\n`);
  };
}

async function start(config) {
  let stage = 'database-init';
  try {
    pgLog = openPgLog(config.logDir);
    postgres = new LocalPostgres({
      dataDir: config.pgDataDir,
      port: config.dbPort,
      user: 'm3u',
      password: config.secrets.dbPassword,
      log: pgLog,
    });

    send({ type: 'status', stage });
    const created = await postgres.initialize();
    stage = 'database-start';
    send({ type: 'status', stage });
    await postgres.start();
    await postgres.ensureDatabase('m3u_editor');

    // Sunucu modulleri ortami yuklenirken okur: tum degiskenler once ayarlanir.
    Object.assign(process.env, {
      NODE_ENV: 'production',
      DB_HOST: '127.0.0.1',
      DB_PORT: String(config.dbPort),
      DB_NAME: 'm3u_editor',
      DB_USER: 'm3u',
      DB_PASSWORD: config.secrets.dbPassword,
      JWT_SECRET: config.secrets.jwtSecret,
      CREDENTIAL_ENCRYPTION_KEY: config.secrets.encryptionKey,
      APP_URL: config.appUrl,
      CORS_ORIGIN: config.appUrl,
      // Yalnizca geri donus arayuzu; araya vekil sunucu girmez.
      TRUST_PROXY: 'false',
      COOKIE_SECURE: 'false',
      FRONTEND_DIST_DIR: config.frontendDir,
      UPLOAD_DIR: path.join(config.dataDir, 'logos'),
      AI_ATTACHMENT_DIR: path.join(config.dataDir, 'ai-attachments'),
      LOG_FILE: path.join(config.logDir, 'server.log'),
      LOG_LEVEL: config.logLevel || 'info',
      ALLOW_REGISTRATION: 'true',
      ALLOW_PRIVATE_NETWORK_URLS: config.allowPrivateNetwork ? 'true' : 'false',
      // Bilgisayarda calisan Ollama / LM Studio kurulum gerektirmeden secilebilsin.
      AI_PROVIDER_PRIVATE_HOSTS: config.aiProviderPrivateHosts,
      SEARXNG_URL: '',
      // Ana surecin yerel hesaba parolasiz oturum acmasi icin; her acilista yeni.
      DESKTOP_LOGIN_TOKEN: config.desktopLoginToken,
    });

    stage = 'migrations';
    send({ type: 'status', stage, firstRun: created });
    const db = require(path.join(config.serverRoot, 'src', 'config', 'database'));
    await db.migrate.latest();

    stage = 'server';
    send({ type: 'status', stage });
    const { startServer } = require(path.join(config.serverRoot, 'src', 'server'));
    server = await startServer({ port: config.appPort, host: '127.0.0.1', probeWebSearch: false });
    send({ type: 'ready', url: config.appUrl, firstRun: created });
  } catch (error) {
    pgLog?.(`HATA (${stage}): ${error?.stack || error}`);
    send({ type: 'fatal', stage, message: String(error?.message || error) });
    await shutdown(1);
  }
}

async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  try {
    if (server) await server.close();
  } catch (error) {
    pgLog?.(`Sunucu kapatılamadı: ${error?.message || error}`);
  }
  try {
    if (postgres) await postgres.stop();
  } catch (error) {
    pgLog?.(`PostgreSQL kapatılamadı: ${error?.message || error}`);
  }
  send({ type: 'stopped' });
  // Mesajin iletilmesi icin bir tur bekle.
  setTimeout(() => process.exit(code), 50);
}

parent?.on('message', (event) => {
  const message = event?.data || event;
  if (message?.type === 'start') start(message.config);
  else if (message?.type === 'shutdown') shutdown(0);
});

process.on('uncaughtException', (error) => {
  pgLog?.(`Yakalanmamış hata: ${error?.stack || error}`);
  send({ type: 'fatal', stage: 'runtime', message: String(error?.message || error) });
  shutdown(1);
});
process.on('unhandledRejection', (error) => {
  pgLog?.(`Yakalanmamış söz reddi: ${error?.stack || error}`);
});
