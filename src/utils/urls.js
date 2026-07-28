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

module.exports = { toAbsoluteMediaUrl, absoluteAppUrl };
