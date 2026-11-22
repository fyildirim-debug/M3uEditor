#!/usr/bin/env node
/**
 * Masaustu paketinin calisma zamani bagimliliklarini sunucununkiyle esitler.
 *
 * Sunucu kodu (src/) paketlenirken desktop/node_modules'u kullanir; kok
 * package.json'a eklenen bir bagimlilik buraya da gelmezse uygulama acilista
 * "Cannot find module" ile duser. `--check` yalnizca denetler (CI), aksi halde
 * desktop/package.json'u gunceller.
 */
const fs = require('fs');
const path = require('path');

const root = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
const desktopFile = path.join(__dirname, '..', 'package.json');
const desktop = JSON.parse(fs.readFileSync(desktopFile, 'utf8'));

const expected = { ...root.dependencies };
const actual = desktop.dependencies || {};
const problems = [];
for (const [name, range] of Object.entries(expected)) {
  if (actual[name] !== range) problems.push(`${name}: sunucu ${range}, masaüstü ${actual[name] || '(yok)'}`);
}
for (const name of Object.keys(actual)) {
  if (!(name in expected)) problems.push(`${name}: yalnızca masaüstünde var`);
}

if (process.argv.includes('--check')) {
  if (problems.length) {
    console.error(`Masaüstü bağımlılıkları sunucuyla uyuşmuyor:\n  ${problems.join('\n  ')}\nDüzeltmek için: npm run sync-deps (desktop/)`);
    process.exit(1);
  }
  console.log('Masaüstü bağımlılıkları sunucuyla aynı.');
} else {
  desktop.dependencies = Object.fromEntries(Object.entries(expected).sort(([a], [b]) => a.localeCompare(b)));
  desktop.version = root.version;
  fs.writeFileSync(desktopFile, `${JSON.stringify(desktop, null, 2)}\n`);
  console.log(problems.length ? `Güncellendi:\n  ${problems.join('\n  ')}` : 'Zaten güncel.');
}
