const safeRegex = require('safe-regex2');
const { createAppError } = require('./AppError');

function parsePagination(page, limit, maxLimit = 500) {
  const parsedPage = Number(page ?? 1);
  const parsedLimit = Number(limit ?? 100);
  if (!Number.isInteger(parsedPage) || parsedPage < 1 || !Number.isInteger(parsedLimit) || parsedLimit < 1) {
    throw createAppError('VALIDATION_ERROR', 'Sayfalama değerleri pozitif tam sayı olmalıdır');
  }
  return { page: parsedPage, limit: Math.min(parsedLimit, maxLimit) };
}

function validateIdArray(ids, max = 1000) {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > max || ids.some((id) => typeof id !== 'string' || !id.trim() || id.length > 200)) {
    throw createAppError('VALIDATION_ERROR', `1-${max} arası geçerli kimlik gönderin`);
  }
  return [...new Set(ids)];
}

function validateRegex(pattern) {
  if (typeof pattern !== 'string' || pattern.length === 0 || pattern.length > 200 || !safeRegex(pattern)) {
    throw createAppError('VALIDATION_ERROR', 'Düzenli ifade güvenli değil veya çok uzun');
  }
}

/**
 * Kanal metin alanlarının bayt üst sınırları.
 * Kolonlar `text` (sınırsız) olduğu için sınır uygulama katmanında zorlanır:
 * aksi halde tek bir istek 25 MB'lık bir değeri 1000 satıra yazabilir.
 */
const CHANNEL_FIELD_LIMITS = Object.freeze({
  name: 500,
  logo_url: 5000,
  stream_url: 5000,
});

/**
 * Bir kanal metin alanını doğrular ve normalize eder.
 * @param {string} field - CHANNEL_FIELD_LIMITS anahtarlarından biri
 * @param {unknown} value
 * @param {{ nullable?: boolean }} [options]
 * @returns {string|null}
 */
function validateChannelField(field, value, { nullable = true } = {}) {
  const limit = CHANNEL_FIELD_LIMITS[field];
  if (!limit) throw createAppError('VALIDATION_ERROR', 'Bilinmeyen kanal alanı');

  if (value === null || value === undefined || value === '') {
    if (nullable) return null;
    throw createAppError('VALIDATION_ERROR', `${field} alanı boş olamaz`);
  }
  if (typeof value !== 'string') {
    throw createAppError('VALIDATION_ERROR', `${field} alanı metin olmalıdır`);
  }
  // Satır sonu/kontrol karakterleri M3U ciktisina fazladan satir enjekte edebilir.
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    throw createAppError('VALIDATION_ERROR', `${field} alanı kontrol karakteri içeremez`);
  }
  const trimmed = value.trim();
  if (Buffer.byteLength(trimmed, 'utf8') > limit) {
    throw createAppError('VALIDATION_ERROR', `${field} alanı en fazla ${limit} bayt olabilir`);
  }
  if (!trimmed && !nullable) {
    throw createAppError('VALIDATION_ERROR', `${field} alanı boş olamaz`);
  }
  return trimmed || (nullable ? null : trimmed);
}

/**
 * Toplu/tekil güncelleme gövdesindeki kanal alanlarını doğrular.
 * `category_id` sahiplik kontrolü servis katmanında yapılır; burada yalnızca tipi doğrulanır.
 * @param {object} updates
 * @returns {object} Yalnızca doğrulanmış alanları içeren nesne
 */
function validateChannelUpdates(updates) {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw createAppError('VALIDATION_ERROR', 'Güncellenecek alanları içeren bir nesne gönderin');
  }

  const validated = {};
  for (const field of Object.keys(CHANNEL_FIELD_LIMITS)) {
    if (updates[field] === undefined) continue;
    validated[field] = validateChannelField(field, updates[field], { nullable: field !== 'name' });
  }

  if (updates.category_id !== undefined) {
    if (updates.category_id !== null && (typeof updates.category_id !== 'string' || !updates.category_id.trim() || updates.category_id.length > 200)) {
      throw createAppError('VALIDATION_ERROR', 'Geçerli bir kategori kimliği gönderin');
    }
    validated.category_id = updates.category_id;
  }

  return validated;
}

function buildDateRange(date, timezoneOffset = 0) {
  const dateStr = date || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw createAppError('VALIDATION_ERROR', 'Tarih YYYY-AA-GG biçiminde olmalıdır');
  const offset = Math.max(-840, Math.min(840, Number.parseInt(timezoneOffset, 10) || 0));
  const utcMidnight = Date.parse(`${dateStr}T00:00:00.000Z`);
  if (!Number.isFinite(utcMidnight) || new Date(utcMidnight).toISOString().slice(0, 10) !== dateStr) {
    throw createAppError('VALIDATION_ERROR', 'Geçerli bir takvim tarihi girin');
  }
  const start = new Date(utcMidnight + offset * 60_000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { dateStr, start, end };
}

module.exports = {
  parsePagination,
  validateIdArray,
  validateRegex,
  buildDateRange,
  validateChannelField,
  validateChannelUpdates,
  CHANNEL_FIELD_LIMITS,
};
