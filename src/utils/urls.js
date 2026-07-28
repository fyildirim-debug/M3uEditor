const config = require('../config');

/**
 * Yüklenen logolar `/logos/<uuid>.<uzanti>` gibi GÖRELİ bir yolla saklanır;
 * bu doğru olandır çünkü kurulumun alan adı değişebilir. Ancak dışarıya verilen
 * çıktılarda (M3U `tvg-logo`, XMLTV `<icon src>`, Xtream `stream_icon`) göreli
 * yol işe yaramaz: player dosyayı bulamaz. Bu yüzden adres yalnızca çıktı
 * üretilirken mutlak hale getirilir.
 *
 * Zaten mutlak olan (sağlayıcıdan gelen) adresler ve `data:` gibi gömülü
 * içerikler olduğu gibi bırakılır.
 *
 * @param {unknown} value
 * @param {string} [baseUrl] - Varsayılan: config.appUrl
 * @returns {string|null}
 */
function toAbsoluteMediaUrl(value, baseUrl = config.appUrl) {
  if (value === null || value === undefined) return null;

  const raw = String(value).trim();
  if (!raw) return null;
  if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(raw)) return raw; // http://, https://, //cdn...
  if (/^(?:data|blob):/i.test(raw)) return raw;

  try {
    return new URL(raw, `${String(baseUrl).replace(/\/+$/, '')}/`).toString();
  } catch {
    return raw;
  }
}

/**
 * Uygulamanın dışarıya verdiği mutlak adresleri kurar.
 * @param {string} path - `/api/shared/abc` gibi kök-göreli yol
 * @returns {string}
 */
function absoluteAppUrl(path) {
  return new URL(String(path).replace(/^\/+/, ''), `${config.appUrl}/`).toString();
}


/**
 * Paylaşım ve Xtream çıkış adresleri kimlik bilgisini sorgu dizesinde taşır
 * (player'lar özel HTTP başlığı gönderemez). Bu adresler günlüğe olduğu gibi
 * yazılırsa şifreler disk üzerinde birikir.
 */
const REDACTED_QUERY_KEYS = new Set(['password', 'share_password', 'token', 'username']);

/**
 * @param {string} originalUrl
 * @returns {string} Hassas sorgu parametreleri maskelenmiş adres
 */
function redactUrl(originalUrl) {
  const url = String(originalUrl ?? '');
  const separator = url.indexOf('?');
  if (separator === -1) return url;

  const params = new URLSearchParams(url.slice(separator + 1));
  let changed = false;
  for (const key of params.keys()) {
    if (REDACTED_QUERY_KEYS.has(key.toLowerCase())) {
      params.set(key, 'REDACTED');
      changed = true;
    }
  }
  return changed ? `${url.slice(0, separator)}?${params.toString()}` : url;
}

module.exports = { toAbsoluteMediaUrl, absoluteAppUrl, redactUrl };
