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

module.exports = { parsePagination, validateIdArray, validateRegex, buildDateRange };
