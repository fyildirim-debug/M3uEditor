/**
 * Kanal adi normallestirme.
 *
 * Ayni kanal saglayicidan saglayiciya farkli yazilir: "TRT 1 FHD", "TR: TRT 1",
 * "TRT1 HD", "trt-1". Hem hazir logo eslestirmesinde hem de bozuk kanallari
 * baska bir kaynaktaki karsiliklariyla degistirirken bu farklari eleyip
 * karsilastirilabilir bir anahtar uretmek gerekiyor; kural tek yerde dursun
 * diye burada.
 */

// Yayin kalitesi, dil ve tasiyici etiketleri kanal KIMLIGININ parcasi degildir.
const NOISE_TOKENS = new Set([
  'hd', 'fhd', 'uhd', 'sd', 'hq', 'lq', '4k', '8k', '1080p', '720p', '576p', '480p',
  'h264', 'h265', 'hevc', 'raw', 'backup', 'yedek', 'test', 'vip', 'plus',
  'tr', 'tur', 'turk', 'turkiye', 'turkey',
]);

// Turkce karakterler sadelestirilir: "İstanbul" ~ "istanbul".
const TRANSLITERATION = {
  ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c',
};

function normalizeChannelName(value) {
  return String(value || '')
    .replace(/[ıİşŞğĞüÜöÖçÇ]/g, (char) => TRANSLITERATION[char] || char)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Gurultu kelimelerini atar; hepsi gurultuyse ham belirtecler korunur. */
function meaningfulTokens(value) {
  const tokens = normalizeChannelName(value).split(' ').filter(Boolean);
  const kept = tokens.filter((token) => !NOISE_TOKENS.has(token));
  return kept.length ? kept : tokens;
}

/**
 * Eslestirme anahtari: gurultusuz belirtecler bosluksuz birlestirilir.
 * "TRT 1 FHD" ve "TR: TRT1 HD" ayni anahtari ("trt1") uretir.
 */
function matchKey(value) {
  return meaningfulTokens(value).join('');
}

module.exports = { normalizeChannelName, meaningfulTokens, matchKey, NOISE_TOKENS };
