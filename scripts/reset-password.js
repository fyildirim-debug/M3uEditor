/**
 * SMTP erişimi olmayan kurulumlarda bir kullanıcının şifresini sıfırla.
 *
 *   npm run reset-password -- user@example.com
 *   npm run reset-password -- user@example.com --password yeni-guclu-sifre
 */
require('dotenv').config();

const crypto = require('crypto');

function printUsage() {
  console.log('Kullanım: npm run reset-password -- <e-posta> [--password <değer>]');
  console.log('  --password  Rastgele şifre üretmek yerine verilen şifreyi kullanır (10-128 karakter).');
}

function formatError(error) {
  if (error.message) return error.message;
  const nestedMessages = error.errors?.map(nested => nested.message).filter(Boolean);
  return nestedMessages?.length ? nestedMessages.join('; ') : String(error);
}

function generatePassword() {
  return crypto.randomBytes(24).toString('base64url');
}

function parseArguments(args) {
  const positionalArgs = [];
  let password;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--password') {
      if (password !== undefined || index + 1 >= args.length || args[index + 1].startsWith('--')) {
        throw new Error('--password seçeneği tam olarak bir değer almalı');
      }
      password = args[index + 1];
      index += 1;
    } else if (argument.startsWith('-')) {
      throw new Error(`Bilinmeyen seçenek: ${argument}`);
    } else {
      positionalArgs.push(argument);
    }
  }

  if (positionalArgs.length !== 1) throw new Error('Tam olarak bir e-posta adresi gerekli');
  const generated = password === undefined;
  return {
    email: positionalArgs[0].trim().toLowerCase(),
    password: generated ? generatePassword() : password,
    generated,
  };
}

async function main(args = process.argv.slice(2)) {
  let options;
  try {
    options = parseArguments(args);
  } catch (error) {
    console.error(`❌ ${formatError(error)}`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  const db = require('../src/config/database');
  const authService = require('../src/services/AuthService');
  try {
    const result = await authService.resetPasswordByEmail(options.email, options.password);
    console.log(`✅ Şifre sıfırlandı: ${result.email}`);
    if (options.generated) console.log(`Yeni şifre: ${options.password}`);
    console.log('Tüm aktif oturumlar iptal edildi.');
  } catch (error) {
    console.error(`❌ Şifre sıfırlanamadı: ${formatError(error)}`);
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

if (require.main === module) main();

module.exports = { generatePassword, parseArguments, main };
