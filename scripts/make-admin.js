/**
 * Kayıtlı bir kullanıcıya yönetici yetkisi ver veya mevcut yetkiyi kaldır.
 *
 *   npm run make-admin -- user@example.com
 *   npm run make-admin -- user@example.com --revoke
 */
require('dotenv').config();

function printUsage() {
  console.log('Kullanım: npm run make-admin -- <e-posta> [--revoke]');
  console.log('  --revoke  Kullanıcının yönetici yetkisini kaldırır.');
}

function formatError(error) {
  if (error.message) return error.message;
  const nestedMessages = error.errors?.map(nested => nested.message).filter(Boolean);
  return nestedMessages?.length ? nestedMessages.join('; ') : String(error);
}

const args = process.argv.slice(2);
const revoke = args.includes('--revoke');
const unknownFlags = args.filter(arg => arg.startsWith('-') && arg !== '--revoke');
const positionalArgs = args.filter(arg => !arg.startsWith('-'));

if (unknownFlags.length || positionalArgs.length !== 1) {
  if (unknownFlags.length) console.error(`Bilinmeyen seçenek: ${unknownFlags.join(', ')}`);
  printUsage();
  process.exitCode = 1;
} else {
  const db = require('../src/config/database');
  const email = positionalArgs[0].trim().toLowerCase();

  async function updateAdminAccess() {
    const user = await db('users').where({ email }).select('id', 'email').first();
    if (!user) {
      console.error(`❌ Kullanıcı bulunamadı: ${email}`);
      process.exitCode = 1;
      return;
    }

    await db('users').where({ id: user.id }).update({
      is_admin: !revoke,
      updated_at: db.fn.now(),
    });

    const action = revoke ? 'kaldırıldı' : 'verildi';
    console.log(`✅ Yönetici yetkisi ${action}: ${user.email}`);
  }

  updateAdminAccess()
    .catch((error) => {
      console.error(`❌ Yönetici yetkisi güncellenemedi: ${formatError(error)}`);
      process.exitCode = 1;
    })
    .finally(() => db.destroy());
}
