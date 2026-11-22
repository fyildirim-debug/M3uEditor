/**
 * Uygulama verisi klasorundeki kalici dosyalar.
 *
 * secrets.json — bu kuruluma ozgu, ilk acilista uretilen gizli degerler
 * (JWT imzasi, kimlik bilgisi sifreleme anahtari, veritabani parolasi). Dosya
 * yalnizca kullanicinin okuyabilecegi izinle yazilir. Silinirse sifreli
 * saklanan Xtream parolalari ve yapay zeka anahtari cozulemez; bu yuzden
 * "verileri sifirla" disinda hicbir yol bu dosyayi yeniden uretmez.
 *
 * settings.json — pencere boyutu, son kullanilan port, kullanici tercihleri.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeJsonAtomic(file, value, mode = 0o600) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), { mode });
  fs.renameSync(temp, file);
}

function randomSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function loadSecrets(dir) {
  const file = path.join(dir, 'secrets.json');
  const existing = readJson(file);
  if (existing?.jwtSecret && existing?.encryptionKey && existing?.dbPassword) return existing;
  // Veri dizini doluysa ama sir dosyasi kayipsa yeni sirlarla devam etmek
  // eski veritabanina baglanamamak demek; bunu acik bir hatayla bildir.
  if (fs.existsSync(path.join(dir, 'pgdata', 'PG_VERSION'))) {
    throw new Error(`Gizli anahtar dosyası (${file}) eksik ya da bozuk; mevcut veritabanı açılamıyor. Yedekten geri yükleyin veya veri klasörünü sıfırlayın.`);
  }
  const secrets = {
    jwtSecret: randomSecret(),
    encryptionKey: randomSecret(),
    dbPassword: randomSecret(),
    createdAt: new Date().toISOString(),
  };
  writeJsonAtomic(file, secrets);
  return secrets;
}

function loadSettings(dir) {
  return {
    windowBounds: null,
    appPort: null,
    dbPort: null,
    allowPrivateNetwork: false,
    aiProviderPrivateHosts: 'localhost:11434,127.0.0.1:11434,localhost:1234,127.0.0.1:1234',
    logLevel: 'info',
    ...(readJson(path.join(dir, 'settings.json')) || {}),
  };
}

function saveSettings(dir, settings) {
  writeJsonAtomic(path.join(dir, 'settings.json'), settings, 0o644);
}

module.exports = { loadSecrets, loadSettings, saveSettings };
