/**
 * Iki adresin ayni kokene (protokol + host + port) ait olup olmadigini soyler.
 *
 * Saklanan bir gizli degerin (API anahtari, Xtream parolasi) yalnizca
 * kaydedildigi sunucuya gonderilmesi icin kullanilir. Ayrismayan ya da bos
 * adres hicbir zaman "ayni" sayilmaz; supheli durumda gizli deger gonderilmez.
 */
function originOf(value) {
  if (!value) return null;
  const raw = String(value).trim();
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

function sameOrigin(a, b) {
  const left = originOf(a);
  const right = originOf(b);
  return Boolean(left && right && left === right);
}

module.exports = { originOf, sameOrigin };
