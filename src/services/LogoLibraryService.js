/**
 * LogoLibraryService — tv-logo/tv-logos deposundaki hazir kanal logolari.
 *
 * Depo 10 binden fazla PNG tasiyor ve klasor duzeni `countries/<ulke>/<slug>.png`
 * ya da `misc/<grup>/<slug>.png` seklinde. Dosya listesi GitHub'in agac
 * ucundan tek istekte alinir, 24 saat bellekte tutulur ve aramalar bu indeks
 * uzerinden yapilir; her arama icin disari istek atilmaz.
 *
 * Gorseller GitHub'dan degil jsDelivr CDN'inden servis edilir: arayuzde bir
 * kerede yuzlerce kucuk resim yukleniyor ve raw.githubusercontent bu is icin
 * ne onbelleklenir ne de hizlidir. Kanal kaydina yazilan `logo_url` de ayni
 * CDN adresidir.
 *
 * Not: jsDelivr'in dosya listesi ucu bu depo icin 403 doner ("package size
 * exceeded 50 MB"), bu yuzden indeks GitHub'dan, gorseller CDN'den gelir.
 */

const { safeFetchJson } = require('../utils/safeFetch');
const { createAppError } = require('../utils/AppError');
const logger = require('../config/logger');
// Ad normallestirmesi StreamRepairService ile paylasilir: iki yerde ayri kural
// olsaydi "TRT 1 FHD" bir yerde eslesip digerinde eslesmezdi.
const { normalizeChannelName: normalize, meaningfulTokens } = require('../utils/channelName');

const REPO = 'tv-logo/tv-logos';
const BRANCH = 'main';
const INDEX_URL = process.env.TV_LOGOS_INDEX_URL
  || `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`;
const CDN_BASE = process.env.TV_LOGOS_CDN_BASE || `https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}`;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const INDEX_MAX_BYTES = 16 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 60_000;
const MAX_RESULTS = 200;

/**
 * `countries/turkey/a-haber-tr.png` -> { group: 'turkey', name: 'A Haber' }
 * Dosya adinin sonundaki ulke kisaltmasi ("-tr", "-us") gosterimden atilir.
 */
function describe(path) {
  const parts = path.split('/');
  const file = parts[parts.length - 1];
  const slug = file.replace(/\.[a-z0-9]+$/i, '');
  // Grup en ust kategoridir: `countries/turkey/...` -> turkey,
  // `countries/nordic/norway/...` -> nordic (alt klasorler ayri ulke sayilmaz),
  // `misc/vod/...` -> vod. Kok altindaki tek dosyalar (`misc/x.png`) kendi
  // adlarini grup yapmasin diye kok klasore duser.
  const group = parts.length > 2 ? parts[1] : parts[0];
  const withoutCountry = slug.replace(/-[a-z]{2,3}$/i, '');
  const words = (withoutCountry || slug).split('-').filter(Boolean);
  const name = words
    .map((word, index) => {
      const capitalized = word.charAt(0).toUpperCase() + word.slice(1);
      if (index > 0 && LOWERCASE_WORDS.has(word)) return word;
      if (word.length <= 3 && !/\d/.test(word) && !LOWERCASE_WORDS.has(word)) return word.toUpperCase();
      return capitalized;
    })
    .join(' ');
  return { slug, group, name: name || slug };
}

// Kisa kelimeler kisaltma sayilip buyutulur (bbc -> BBC, ntv -> NTV) ama
// baglaclar haric: "the-matrix" -> "The Matrix", "THE Matrix" degil.
const LOWERCASE_WORDS = new Set(['the', 'and', 'for', 'of', 'in', 'on', 'at', 'to', 'a', 'an', 've', 'de', 'da', 'la', 'le', 'el', 'il', 'du', 'des']);

// Klasor adi -> ISO 3166-1 alpha-2. Kodu olan gruplar arayuzde kullanicinin
// dilinde gosterilir ("turkey" -> Türkiye / Turkey); kodu olmayanlar (bolgeler
// ve misc klasorleri) kendi cevirisine ya da basliklanmis ada duser.
const COUNTRY_CODES = {
  albania: 'AL', argentina: 'AR', australia: 'AU', austria: 'AT', azerbaijan: 'AZ',
  belgium: 'BE', brazil: 'BR', bulgaria: 'BG', canada: 'CA', chile: 'CL',
  'costa-rica': 'CR', croatia: 'HR', 'czech-republic': 'CZ', france: 'FR',
  germany: 'DE', greece: 'GR', 'hong-kong': 'HK', hungary: 'HU', india: 'IN',
  indonesia: 'ID', ireland: 'IE', israel: 'IL', italy: 'IT', lebanon: 'LB',
  lithuania: 'LT', luxembourg: 'LU', malaysia: 'MY', malta: 'MT', mexico: 'MX',
  netherlands: 'NL', 'new-zealand': 'NZ', philippines: 'PH', poland: 'PL',
  portugal: 'PT', romania: 'RO', russia: 'RU', serbia: 'RS', singapore: 'SG',
  slovakia: 'SK', slovenia: 'SI', 'south-africa': 'ZA', spain: 'ES',
  switzerland: 'CH', turkey: 'TR', ukraine: 'UA', 'united-arab-emirates': 'AE',
  'united-kingdom': 'GB', 'united-states': 'US',
};

function titleCase(value) {
  return String(value).split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

class LogoLibraryService {
  constructor() {
    this._cache = null; // { items, groups, fetchedAt }
    this._pending = null;
  }

  /** Indeksi tek seferde ceker; es zamanli cagrilar ayni istegi paylasir. */
  async _index() {
    if (this._cache && Date.now() - this._cache.fetchedAt < CACHE_TTL_MS) return this._cache;
    if (this._pending) return this._pending;

    const request = (async () => {
      logger.info({ url: INDEX_URL }, 'LogoLibrary: logo dizini indiriliyor');
      const headers = { accept: 'application/vnd.github+json' };
      // Anonim GitHub limiti saatte 60 istek; token verilirse 5000'e cikar.
      // Gunde bir kez cekildigi icin token olmadan da yeterli.
      if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

      const { data } = await safeFetchJson(INDEX_URL, {
        timeoutMs: FETCH_TIMEOUT_MS,
        maxBytes: INDEX_MAX_BYTES,
        headers,
      });
      const tree = Array.isArray(data?.tree) ? data.tree : (Array.isArray(data) ? data : null);
      if (!tree) throw createAppError('VALIDATION_ERROR', 'Logo dizini beklenmeyen biçimde');

      const items = [];
      const groups = new Map();
      for (const entry of tree) {
        const path = entry?.path;
        if (entry?.type === 'tree' || typeof path !== 'string') continue;
        if (!/\.(png|jpe?g|webp|svg)$/i.test(path)) continue;

        const { slug, group, name } = describe(path);
        items.push({
          path,
          name,
          group,
          url: `${CDN_BASE}/${path.split('/').map(encodeURIComponent).join('/')}`,
          // Arama metni bir kez hesaplanir: 10 bin kayitta her tusa basista
          // yeniden uretmek gereksiz is.
          haystack: normalize(`${name} ${slug} ${group}`),
          words: normalize(`${name} ${slug}`).split(' ').filter(Boolean),
        });
        groups.set(group, (groups.get(group) || 0) + 1);
      }

      if (!items.length) throw createAppError('VALIDATION_ERROR', 'Logo dizininde görsel bulunamadı');

      return {
        items,
        groups: [...groups.entries()]
          .map(([id, count]) => ({
            id,
            label: titleCase(id),
            code: COUNTRY_CODES[id] || null,
            kind: COUNTRY_CODES[id] ? 'country' : 'other',
            count,
          }))
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'tr')),
        fetchedAt: Date.now(),
      };
    })();

    this._pending = request;
    try {
      this._cache = await request;
      logger.info({ count: this._cache.items.length, groups: this._cache.groups.length }, 'LogoLibrary: dizin hazır');
      return this._cache;
    } catch (error) {
      logger.warn({ err: error }, 'LogoLibrary: dizin indirilemedi');
      // Bayat indeks hicbir seyden iyidir; ilk yuklemede hata yukselir.
      if (this._cache) return this._cache;
      throw createAppError('VALIDATION_ERROR', 'Logo kütüphanesine şu an erişilemiyor. Biraz sonra tekrar deneyin.');
    } finally {
      this._pending = null;
    }
  }

  /**
   * Alaka puani. Kanal adi ile logo adi nadiren birebir ayni oldugu icin
   * (ör. "TRT 1 FHD" ↔ "trt-1-tr") once tam eslesme, sonra onek, sonra
   * belirtec ortusmesi aranir.
   */
  _score(item, tokens, joined, preferGroup) {
    const haystack = item.haystack;
    if (!joined) return 1;
    // Ayni puanli iki logodan kullanicinin ulkesindekini one alir; filtre
    // degil, yalnizca esitlik bozucudur.
    const bonus = preferGroup && item.group === preferGroup ? 40 : 0;

    if (haystack === joined) return 1000 + bonus;

    const compactHaystack = haystack.replace(/ /g, '');
    const compactQuery = joined.replace(/ /g, '');
    if (compactHaystack === compactQuery) return 900 + bonus;
    if (haystack.startsWith(`${joined} `) || compactHaystack.startsWith(compactQuery)) return 700 + bonus;
    // Alt dizi eslesmesi yalnizca uc harften uzun sorgularda: "d" gibi kisa bir
    // sorgu icinde "d" gecen her logoyu sonuc sayardi.
    if (joined.length >= 3 && haystack.includes(joined)) return 500 + bonus;

    // Kismi eslesme kelime siniri uzerinden yapilir: ham `includes` ile "1"
    // belirteci "10"u, "d" ise her kelimeyi tutuyordu ve siralama bozuluyordu.
    let matched = 0;
    for (const token of tokens) {
      const hit = item.words.some((word) => word === token || (token.length >= 3 && word.startsWith(token)));
      if (hit) matched += 1;
    }
    if (matched === tokens.length) return 300 + bonus;
    // Yarisindan azi tutan kayit sonuc sayilmaz; aksi halde tek kelimesi gecen
    // binlerce logo listeye giriyor.
    if (tokens.length > 1 && matched * 2 >= tokens.length) return Math.round((matched / tokens.length) * 120) + bonus;
    return 0;
  }

  async search({ q, group, preferGroup, limit = 60, offset = 0 } = {}) {
    const index = await this._index();
    const tokens = q ? meaningfulTokens(q) : [];
    const joined = tokens.join(' ');
    const groupFilter = group ? String(group).trim().toLowerCase() : '';
    const preferred = preferGroup ? String(preferGroup).trim().toLowerCase() : '';

    const scored = [];
    for (const item of index.items) {
      if (groupFilter && item.group !== groupFilter) continue;
      const score = this._score(item, tokens, joined, preferred);
      if (!score) continue;
      scored.push({ item, score });
    }

    // Ayni puanda kisa ad once: "trt 1", "trt 1 belgesel"in onunde gelir.
    scored.sort((a, b) => b.score - a.score
      || a.item.name.length - b.item.name.length
      || a.item.name.localeCompare(b.item.name, 'tr'));

    const start = Math.max(Number(offset) || 0, 0);
    const size = Math.min(Math.max(Number(limit) || 60, 1), MAX_RESULTS);
    return {
      total: scored.length,
      offset: start,
      limit: size,
      updatedAt: new Date(index.fetchedAt).toISOString(),
      logos: scored.slice(start, start + size).map(({ item }) => ({
        name: item.name,
        group: item.group,
        path: item.path,
        url: item.url,
      })),
    };
  }

  async listGroups() {
    const index = await this._index();
    return { total: index.items.length, groups: index.groups };
  }

  /**
   * Bir kanal adi icin en iyi eslesme. Asistan toplu logo atamasinda kullanir;
   * `minScore` altindaki tahminler dondurulmez ki yanlis logo yapistirilmasin.
   */
  async bestMatch(channelName, { group, preferGroup, minScore = 300 } = {}) {
    const index = await this._index();
    const tokens = meaningfulTokens(channelName);
    if (!tokens.length) return null;
    const joined = tokens.join(' ');
    const groupFilter = group ? String(group).trim().toLowerCase() : '';
    const preferred = preferGroup ? String(preferGroup).trim().toLowerCase() : '';

    let best = null;
    for (const item of index.items) {
      if (groupFilter && item.group !== groupFilter) continue;
      const score = this._score(item, tokens, joined, preferred);
      if (score >= minScore && (!best || score > best.score || (score === best.score && item.name.length < best.item.name.length))) {
        best = { item, score };
      }
    }
    return best ? { name: best.item.name, group: best.item.group, url: best.item.url, score: best.score } : null;
  }
}

module.exports = new LogoLibraryService();
module.exports.normalize = normalize;
module.exports.describe = describe;
module.exports.meaningfulTokens = meaningfulTokens;
