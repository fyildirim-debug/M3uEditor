/**
 * Veritabanina ulasilamadigini gosteren hatalarin tanimi.
 *
 * PostgreSQL kapaliyken API her istekte genel "beklenmeyen hata" donuyordu ve
 * kullanici sorunun veritabaninda oldugunu anlayamiyordu (GitHub #2). Bu hatalar
 * errorHandler'da 503 DATABASE_UNAVAILABLE olarak eslenir ve acilista okunur
 * bir aciklamayla gunluge yazilir.
 */
const NETWORK_CODES = new Set([
  'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH',
]);
// SQLSTATE: 08xxx baglanti istisnalari, 57P01-57P03 sunucu kapaniyor/baslatiliyor,
// 53300 baglanti sayisi dolu, 3D000 veritabani yok, 28P01/28000 kimlik dogrulama.
const SQLSTATE_CODES = new Set([
  '08000', '08001', '08003', '08004', '08006', '57P01', '57P02', '57P03', '53300', '3D000', '28P01', '28000',
]);

function collectCodes(error, depth = 0) {
  if (!error || typeof error !== 'object' || depth > 3) return [];
  const codes = [error.code, error.errno].filter((value) => typeof value === 'string');
  if (Array.isArray(error.errors)) {
    for (const inner of error.errors) codes.push(...collectCodes(inner, depth + 1));
  }
  if (error.cause) codes.push(...collectCodes(error.cause, depth + 1));
  return codes;
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
function isDatabaseUnavailableError(error) {
  if (!error || typeof error !== 'object') return false;
  if (error.name === 'KnexTimeoutError') return true;
  const codes = collectCodes(error);
  if (codes.some((code) => NETWORK_CODES.has(code) || SQLSTATE_CODES.has(code))) return true;
  const message = String(error.message || '');
  return /Connection terminated unexpectedly|Timeout acquiring a connection|connect ECONNREFUSED/i.test(message);
}

/**
 * Acilis gunlugu icin insan okuyabilir aciklama.
 * @param {unknown} error
 * @param {{ host?: string, port?: string|number, database?: string }} [connection]
 */
function describeDatabaseError(error, connection = {}) {
  const target = `${connection?.host || 'localhost'}:${connection?.port || 5432}/${connection?.database || '?'}`;
  const codes = collectCodes(error);
  if (codes.includes('3D000')) {
    return `PostgreSQL'e bağlanıldı ama "${connection?.database || '?'}" veritabanı yok. Veritabanını oluşturup "npm run migrate" çalıştırın.`;
  }
  if (codes.includes('28P01') || codes.includes('28000')) {
    return `PostgreSQL kimlik doğrulaması başarısız (${target}). DB_USER / DB_PASSWORD değerlerini kontrol edin.`;
  }
  if (codes.includes('ENOTFOUND') || codes.includes('EAI_AGAIN')) {
    return `Veritabanı sunucusunun adresi çözümlenemedi (${target}). DB_HOST değerini kontrol edin.`;
  }
  return `Veritabanına bağlanılamadı (${target}). PostgreSQL'in çalıştığından ve DB_HOST / DB_PORT / DB_NAME ayarlarının doğru olduğundan emin olun. API, veritabanı erişilebilir olana kadar 503 DATABASE_UNAVAILABLE döner.`;
}

module.exports = { isDatabaseUnavailableError, describeDatabaseError };
