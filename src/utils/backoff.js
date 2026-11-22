/**
 * Zamanlanmis islerin hata sonrasi geri cekilmesi.
 *
 * Ilk hatadan sonra bir aralik beklenir, sonraki her ardisik hatada bekleme
 * ikiye katlanir. Alt sinir 5 dakika, ust sinir 24 saat: saglayici kalici olarak
 * bozuksa gunde bir denenir, gecici bir arizada ise liste uzun sure eskimez.
 */
const MIN_BACKOFF_MINUTES = 5;
const MAX_BACKOFF_MINUTES = 24 * 60;
const MAX_EXPONENT = 16;

/**
 * @param {number|null|undefined} intervalMinutes - isin normal araligi
 * @param {number} failureCount - bu hata dahil ardisik hata sayisi (>= 1)
 * @returns {number} dakika
 */
function backoffMinutes(intervalMinutes, failureCount) {
  const base = Math.max(MIN_BACKOFF_MINUTES, Number(intervalMinutes) || MIN_BACKOFF_MINUTES);
  const exponent = Math.min(Math.max(Number(failureCount) || 1, 1) - 1, MAX_EXPONENT);
  return Math.min(MAX_BACKOFF_MINUTES, base * (2 ** exponent));
}

/**
 * @returns {Date} bir sonraki deneme zamani
 */
function nextAttemptAt(intervalMinutes, failureCount, now = new Date()) {
  return new Date(now.getTime() + backoffMinutes(intervalMinutes, failureCount) * 60_000);
}

module.exports = { backoffMinutes, nextAttemptAt, MIN_BACKOFF_MINUTES, MAX_BACKOFF_MINUTES };
