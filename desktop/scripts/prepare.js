#!/usr/bin/env node
/**
 * Paketlemeden once sunucu kodunu ve derlenmis arayuzu desktop/ altina kopyalar.
 *
 *   desktop/server/   <- src/, knexfile.js, public/
 *   desktop/renderer/ <- frontend/dist/  (yoksa ya da --build verilirse derlenir)
 *
 * Linux'ta gomulu PostgreSQL kitapliklarindaki sembolik baglar gercek dosyaya
 * cevrilir: AppImage salt-okunur oldugu icin calisma aninda yeniden
 * olusturulamazlar ve bazi paketleme adimlari baglari korumaz.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const desktopDir = path.resolve(__dirname, '..');
const repoDir = path.resolve(desktopDir, '..');
const frontendDir = path.join(repoDir, 'frontend');

function copyDir(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true, dereference: true });
}

// 1) Bagimliliklar sunucuyla ayni mi?
execSync(`node ${JSON.stringify(path.join(__dirname, 'sync-deps.js'))} --check`, { stdio: 'inherit' });

// 2) Arayuz
const distDir = path.join(frontendDir, 'dist');
if (process.argv.includes('--build') || !fs.existsSync(path.join(distDir, 'index.html'))) {
  console.log('Arayüz derleniyor…');
  execSync('npm run build', { cwd: frontendDir, stdio: 'inherit' });
}
copyDir(distDir, path.join(desktopDir, 'renderer'));

// 3) Sunucu
const serverDir = path.join(desktopDir, 'server');
fs.rmSync(serverDir, { recursive: true, force: true });
fs.mkdirSync(serverDir, { recursive: true });
copyDir(path.join(repoDir, 'src'), path.join(serverDir, 'src'));
copyDir(path.join(repoDir, 'public'), path.join(serverDir, 'public'));
fs.copyFileSync(path.join(repoDir, 'knexfile.js'), path.join(serverDir, 'knexfile.js'));

// 4) PostgreSQL kitapliklarindaki sembolik baglar
const pgScope = path.join(desktopDir, 'node_modules', '@embedded-postgres');
let materialized = 0;
if (fs.existsSync(pgScope)) {
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        const target = fs.realpathSync(full);
        fs.unlinkSync(full);
        fs.copyFileSync(target, full);
        fs.chmodSync(full, fs.statSync(target).mode);
        materialized += 1;
      } else if (entry.isDirectory()) {
        walk(full);
      }
    }
  };
  walk(pgScope);
}

// 5) Windows: PostgreSQL ikilileri Visual C++ calisma zamanina (vcruntime140)
// baglidir ve paket bunu icermez. Temiz bir Windows'ta veritabani acilmasin
// diye Microsoft'un uygulamayla birlikte dagitilmasina izin verdigi DLL'ler
// derleme makinesinden ikililerin yanina kopyalanir (app-local deployment).
let runtimeCopied = 0;
const winBin = path.join(pgScope, 'windows-x64', 'native', 'bin');
if (process.platform === 'win32' && fs.existsSync(winBin)) {
  const systemDir = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32');
  for (const dll of ['vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll']) {
    const target = path.join(winBin, dll);
    const source = path.join(systemDir, dll);
    if (!fs.existsSync(target) && fs.existsSync(source)) {
      fs.copyFileSync(source, target);
      runtimeCopied += 1;
    }
  }
  if (!fs.existsSync(path.join(winBin, 'vcruntime140.dll'))) {
    throw new Error('vcruntime140.dll bulunamadı; Windows paketinde PostgreSQL açılmaz. Derleme makinesine Visual C++ çalışma zamanını kurun.');
  }
}

console.log(`Hazır: server/, renderer/${materialized ? `, ${materialized} sembolik bağ dosyaya çevrildi` : ''}${runtimeCopied ? `, ${runtimeCopied} VC++ DLL eklendi` : ''}.`);
