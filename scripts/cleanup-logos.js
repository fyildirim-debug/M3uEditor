require('dotenv').config();

const fs = require('fs').promises;
const config = require('../src/config');
const db = require('../src/config/database');
const { LOGO_EXTENSIONS, getChannelLogoPath, stripLogoUrlVersion } = require('../src/utils/logoStorage');
const { validate: validateUuid } = require('uuid');

const QUERY_BATCH_SIZE = 1000;
const LOGO_PATTERN = new RegExp(`^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\\.(${LOGO_EXTENSIONS.join('|')})$`);

function parseMode(argv) {
  const flags = new Set(argv);
  const unknown = argv.filter((arg) => !['--dry-run', '--delete'].includes(arg));
  if (unknown.length > 0 || (flags.has('--dry-run') && flags.has('--delete'))) {
    throw new Error('Kullanım: node scripts/cleanup-logos.js [--dry-run | --delete]');
  }
  return flags.has('--delete') ? 'delete' : 'dry-run';
}

async function scanLogoFiles() {
  let entries;
  try {
    entries = await fs.readdir(config.uploadDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(LOGO_PATTERN);
    if (!match || !validateUuid(match[1])) continue;
    const stats = await fs.stat(getChannelLogoPath(match[1], match[2]));
    files.push({
      channelId: match[1].toLowerCase(),
      extension: match[2].toLowerCase(),
      filename: entry.name,
      size: stats.size,
    });
  }
  return files;
}

async function findOrphans(files) {
  const currentLogos = new Map();
  const channelIds = [...new Set(files.map((file) => file.channelId))];
  for (let offset = 0; offset < channelIds.length; offset += QUERY_BATCH_SIZE) {
    const rows = await db('channels')
      .whereIn('id', channelIds.slice(offset, offset + QUERY_BATCH_SIZE))
      .select('id', 'logo_url');
    for (const row of rows) currentLogos.set(row.id.toLowerCase(), row.logo_url);
  }
  // Yuklenen logolarin adresi onbellek kirilsin diye `?v=` damgasi tasir;
  // damga atilmadan karsilastirilirsa kullanimdaki her logo yetim sanilir.
  return files.filter((file) => stripLogoUrlVersion(currentLogos.get(file.channelId)) !== `/logos/${file.filename}`);
}

async function main(argv = process.argv.slice(2)) {
  const mode = parseMode(argv);
  const files = await scanLogoFiles();
  const orphans = await findOrphans(files);
  const orphanBytes = orphans.reduce((total, file) => total + file.size, 0);

  console.log(`Mod: ${mode === 'delete' ? 'delete' : 'dry-run'}`);
  console.log(`Yükleme dizini: ${config.uploadDir}`);
  console.log(`Taranan logo: ${files.length} dosya`);
  console.log(`Yetim logo: ${orphans.length} dosya, ${orphanBytes} bayt`);

  if (mode === 'delete') {
    let deletedFiles = 0;
    let deletedBytes = 0;
    for (const orphan of orphans) {
      try {
        await fs.unlink(getChannelLogoPath(orphan.channelId, orphan.extension));
        deletedFiles += 1;
        deletedBytes += orphan.size;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    console.log(`Silinen logo: ${deletedFiles} dosya, ${deletedBytes} bayt`);
  } else {
    console.log('Dosya silinmedi. Silmek için --delete kullanın.');
  }

  return { mode, files, orphans };
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error('Logo temizleme hatası:', error.message);
      process.exitCode = 1;
    })
    .finally(() => db.destroy().catch(() => {}));
}

module.exports = { parseMode, scanLogoFiles, findOrphans, main };
