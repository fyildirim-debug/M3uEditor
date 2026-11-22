/**
 * Uygulamayla birlikte gelen PostgreSQL'i yonetir.
 *
 * Masaustu kullanicisindan PostgreSQL kurmasi beklenmez: platforma ozgu
 * ikili dosyalar (`@embedded-postgres/<platform>`) paketin icindedir, veri
 * dizini kullanicinin uygulama verisi klasorundedir. Sunucu yalnizca
 * 127.0.0.1'i dinler; Unix soketi kapali (soket dizini her sistemde yazilabilir
 * degil, ayrica gereksiz bir giris kapisi).
 *
 * Kapanis `pg_ctl stop -m fast` iledir: yarim kalan islemler geri alinir,
 * veri tutarli kalir. (Hazir kutuphane Windows'ta sureci taskkill /f ile
 * olduruyor; PostgreSQL bundan WAL ile kurtulur ama her acilista kurtarma
 * calistirmak gereksiz.)
 */
const { spawn } = require('child_process');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

function platformPackage() {
  const platform = os.platform();
  const arch = os.arch();
  if (platform === 'win32' && arch === 'x64') return '@embedded-postgres/windows-x64';
  if (platform === 'linux' && ['x64', 'arm64'].includes(arch)) return `@embedded-postgres/linux-${arch}`;
  if (platform === 'darwin' && ['x64', 'arm64'].includes(arch)) return `@embedded-postgres/darwin-${arch}`;
  throw new Error(`Bu platform desteklenmiyor: ${platform}/${arch}`);
}

/** Paketlenmis uygulamada ikililer app.asar disinda (app.asar.unpacked) durur. */
function unpacked(filePath) {
  return filePath.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
}

function resolveBinaries() {
  const entry = require.resolve(platformPackage());
  const nativeDir = unpacked(path.resolve(path.dirname(entry), '..', 'native'));
  const ext = os.platform() === 'win32' ? '.exe' : '';
  const binDir = path.join(nativeDir, 'bin');
  const binaries = {
    nativeDir,
    binDir,
    initdb: path.join(binDir, `initdb${ext}`),
    postgres: path.join(binDir, `postgres${ext}`),
    pgCtl: path.join(binDir, `pg_ctl${ext}`),
  };
  for (const key of ['initdb', 'postgres', 'pgCtl']) {
    if (!fs.existsSync(binaries[key])) throw new Error(`PostgreSQL bileşeni bulunamadı: ${binaries[key]}`);
  }
  return binaries;
}

function run(command, args, { log, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, env: { ...process.env, ...env } });
    let output = '';
    const collect = (chunk) => {
      const text = chunk.toString('utf8');
      output += text;
      log?.(text.trimEnd());
    };
    child.stdout?.on('data', collect);
    child.stderr?.on('data', collect);
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`${path.basename(command)} ${code} koduyla çıktı:\n${output.slice(-2000)}`));
    });
  });
}

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

class LocalPostgres {
  /**
   * @param {{ dataDir: string, port: number, user: string, password: string, log?: (line: string) => void }} options
   */
  constructor({ dataDir, port, user, password, log }) {
    this.dataDir = dataDir;
    this.port = port;
    this.user = user;
    this.password = password;
    this.log = log || (() => {});
    // PostgreSQL kendini root olarak calistirmayi reddeder; anlasilir hata ver.
    if (typeof process.getuid === 'function' && process.getuid() === 0) {
      throw new Error('M3U Editor root (yönetici) olarak çalıştırılamaz: gömülü PostgreSQL buna izin vermiyor. Uygulamayı normal kullanıcınızla açın.');
    }
    this.bin = resolveBinaries();
    this.process = null;
  }

  get initialized() {
    return fs.existsSync(path.join(this.dataDir, 'PG_VERSION'));
  }

  /** Veri dizini yoksa olusturur (ilk acilis). */
  async initialize() {
    if (this.initialized) return false;
    await fsp.mkdir(this.dataDir, { recursive: true, mode: 0o700 });
    // Parola komut satirinda gorunmesin diye gecici dosyadan verilir.
    const pwFile = path.join(os.tmpdir(), `m3u-pg-${crypto.randomBytes(8).toString('hex')}`);
    await fsp.writeFile(pwFile, `${this.password}\n`, { mode: 0o600 });
    try {
      await run(this.bin.initdb, [
        `--pgdata=${this.dataDir}`,
        `--username=${this.user}`,
        `--pwfile=${pwFile}`,
        '--auth=scram-sha-256',
        '--encoding=UTF8',
        // ICU: Turkce I/ı, Ş/ş gibi harflerde buyuk-kucuk harf duyarsiz arama
        // (ILIKE, lower) dogru calissin. C yerelinde yalnizca ASCII katlanir.
        '--locale-provider=icu',
        '--icu-locale=und',
        '--locale=C',
      ], { log: this.log, env: { LC_ALL: 'C' } });
    } finally {
      await fsp.rm(pwFile, { force: true });
    }
    return true;
  }

  /** Onceki oturumdan (cokme) kalan bir sunucu calisiyorsa durdurur. */
  async _stopLeftover() {
    const pidFile = path.join(this.dataDir, 'postmaster.pid');
    if (!fs.existsSync(pidFile)) return;
    const pid = Number.parseInt(fs.readFileSync(pidFile, 'utf8').split('\n')[0], 10);
    if (!Number.isInteger(pid) || !processAlive(pid)) return; // PostgreSQL bayat kilidi kendi temizler
    this.log(`Önceki oturumdan kalan PostgreSQL (pid ${pid}) durduruluyor`);
    await run(this.bin.pgCtl, ['stop', '-D', this.dataDir, '-m', 'fast', '-w', '-t', '30'], { log: this.log }).catch((error) => {
      this.log(`Önceki sunucu durdurulamadı: ${error.message}`);
    });
  }

  async start() {
    await this._stopLeftover();
    if (os.platform() === 'win32') {
      await this._startWithPgCtl();
      return;
    }
    const args = [
      '-D', this.dataDir,
      '-p', String(this.port),
      '-c', 'listen_addresses=127.0.0.1',
      // Tek kullanicili masaustu: varsayilan 100 baglanti gereksiz bellek.
      '-c', 'max_connections=40',
      '-c', 'shared_buffers=64MB',
    ];
    if (os.platform() !== 'win32') args.push('-c', 'unix_socket_directories=');

    await new Promise((resolve, reject) => {
      let settled = false;
      const child = spawn(this.bin.postgres, args, { windowsHide: true, env: { ...process.env, LC_MESSAGES: 'C' } });
      this.process = child;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('PostgreSQL 60 saniye içinde hazır olmadı'));
      }, 60_000);
      const onData = (chunk) => {
        const text = chunk.toString('utf8');
        this.log(text.trimEnd());
        if (!settled && text.includes('database system is ready to accept connections')) {
          settled = true;
          clearTimeout(timer);
          resolve();
        }
      };
      child.stdout?.on('data', onData);
      child.stderr?.on('data', onData);
      child.on('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });
      child.on('exit', (code) => {
        this.process = null;
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error(`PostgreSQL açılırken kapandı (kod ${code}). Ayrıntı için günlüğe bakın.`));
      });
    });
  }

  /**
   * Windows: postgres.exe yonetici yetkili bir surecten dogrudan baslatilirsa
   * reddeder ("administrative permissions"). pg_ctl kisitli bir erisim
   * belirteciyle baslatir; kullanici uygulamayi yonetici olarak acsa da calisir.
   */
  async _startWithPgCtl() {
    const logFile = path.join(path.dirname(this.dataDir), 'logs', 'postgres-server.log');
    await fsp.mkdir(path.dirname(logFile), { recursive: true });
    const options = [
      `-p ${this.port}`,
      '-c listen_addresses=127.0.0.1',
      '-c max_connections=40',
      '-c shared_buffers=64MB',
    ].join(' ');
    await run(this.bin.pgCtl, ['start', '-D', this.dataDir, '-l', logFile, '-w', '-t', '60', '-o', options], {
      log: this.log,
      env: { LC_MESSAGES: 'C' },
    });
    this.startedWithPgCtl = true;
  }

  async stop() {
    if (this.startedWithPgCtl) {
      this.startedWithPgCtl = false;
      await run(this.bin.pgCtl, ['stop', '-D', this.dataDir, '-m', 'fast', '-w', '-t', '30'], { log: this.log })
        .catch((error) => this.log(`pg_ctl stop başarısız: ${error.message}`));
      return;
    }
    if (!this.process) return;
    const child = this.process;
    const exited = new Promise((resolve) => child.once('exit', resolve));
    try {
      await run(this.bin.pgCtl, ['stop', '-D', this.dataDir, '-m', 'fast', '-w', '-t', '30'], { log: this.log });
    } catch (error) {
      this.log(`pg_ctl stop başarısız, süreç sonlandırılıyor: ${error.message}`);
      child.kill();
    }
    await Promise.race([exited, new Promise((resolve) => { setTimeout(resolve, 10_000); })]);
    this.process = null;
  }

  /** Veritabani yoksa olusturur. `pg` istemcisi uygulamanin bagimliligi. */
  async ensureDatabase(name) {
    const { Client } = require('pg');
    const client = new Client({ host: '127.0.0.1', port: this.port, user: this.user, password: this.password, database: 'postgres' });
    await client.connect();
    try {
      const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
      if (!rowCount) await client.query(`CREATE DATABASE "${name.replace(/"/g, '')}" TEMPLATE template0 ENCODING 'UTF8'`);
    } finally {
      await client.end();
    }
  }
}

module.exports = { LocalPostgres, resolveBinaries, platformPackage };
