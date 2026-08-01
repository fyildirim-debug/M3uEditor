// EpgLibraryService - iptv-org kaynak kutuphanesi.
// https://iptv-org.github.io/api/guides.json ve countries.json dosyalarini ceker,
// 24 saat bellekte cache'ler ve site bazinda filtrelenmis rehber listesi sunar.

const { safeFetchJson } = require('../utils/safeFetch');
const { createAppError } = require('../utils/AppError');
const logger = require('../config/logger');

const GUIDES_URL = 'https://iptv-org.github.io/api/guides.json';
const COUNTRIES_URL = 'https://iptv-org.github.io/api/countries.json';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 saat
const COUNTRIES_MAX_BYTES = 5 * 1024 * 1024;
// guides.json su an ~26MB; 5MB limiti dosyanin tamamini karsilayamaz.
const GUIDES_MAX_BYTES = 40 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 60_000;
const MAX_NAMES_PER_SITE = 2000; // arama icin site basina tutulan kanal adi siniri

// Kanal id'leri "BBCOne.uk" formatinda; son parca ISO 3166-1 alpha-2 ulke kodudur.
function countryFromChannelId(channelId) {
  if (typeof channelId !== 'string') return null;
  const dot = channelId.lastIndexOf('.');
  if (dot < 0) return null;
  const suffix = channelId.slice(dot + 1);
  return /^[a-z]{2}$/.test(suffix) ? suffix.toUpperCase() : null;
}

// Kanali olmayan (site geneli) kayitlar icin site alan adindaki ccTLD'ye duser.
// "abc.net.au" -> AU, "9tv.co.il" -> IL; ".com/.net/.org" gibi jenerik TLD'ler atlanir.
const GENERIC_TLDS = new Set(['com', 'net', 'org', 'tv', 'io', 'info', 'biz', 'co', 'me', 'app', 'online', 'xyz']);

function countryFromSite(site) {
  const labels = String(site).toLowerCase().split('.');
  if (labels.length < 2) return null;
  const tld = labels[labels.length - 1];
  if (/^[a-z]{2}$/.test(tld) && !GENERIC_TLDS.has(tld)) return tld.toUpperCase();
  return null;
}

// Yayinlanmis guide URL'leri arasindan tercih sirasina gore secim: duz XML > GZIP > JSON > ilk.
function pickGuideUrl(urlsByFormat) {
  for (const format of ['XML', 'GZIP', 'JSON']) {
    if (urlsByFormat.has(format)) return urlsByFormat.get(format);
  }
  const first = urlsByFormat.values().next();
  return first.done ? null : first.value;
}

class EpgLibraryService {
  constructor() {
    this._cache = new Map(); // key -> { data, fetchedAt }
    this._pending = new Map(); // key -> Promise (es zamanli cagrilari tek istege indirir)
  }

  async _cached(key, url, maxBytes, transform) {
    const hit = this._cache.get(key);
    if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit.data;

    const inFlight = this._pending.get(key);
    if (inFlight) return inFlight;

    const request = (async () => {
      logger.info(`EpgLibrary: ${key} indiriliyor (${url})`);
      const { data } = await safeFetchJson(url, { timeoutMs: FETCH_TIMEOUT_MS, maxBytes });
      return transform(data);
    })();
    this._pending.set(key, request);

    try {
      const data = await request;
      this._cache.set(key, { data, fetchedAt: Date.now() });
      return data;
    } catch (error) {
      logger.warn(`EpgLibrary: ${key} indirilemedi: ${error.message}`);
      // Eski cache varsa bayat veriyle devam et, yoksa hatayi yukselt.
      if (hit) return hit.data;
      throw createAppError('EPG_FETCH_FAILED', 'EPG kaynak kütüphanesi şu an erişilemiyor');
    } finally {
      this._pending.delete(key);
    }
  }

  // guides.json kayitlarini site bazinda tek satira indirger.
  _aggregateGuides(entries) {
    const bySite = new Map();
    for (const entry of entries) {
      if (!entry || typeof entry.site !== 'string' || !entry.site) continue;
      let group = bySite.get(entry.site);
      if (!group) {
        group = { site: entry.site, channelCount: 0, names: [], countries: new Set(), langs: new Set(), urlsByFormat: new Map() };
        bySite.set(entry.site, group);
      }
      group.channelCount += 1;
      if (typeof entry.site_name === 'string' && entry.site_name && group.names.length < MAX_NAMES_PER_SITE) {
        group.names.push(entry.site_name);
      }
      const country = countryFromChannelId(entry.channel) || countryFromSite(entry.site);
      if (country) group.countries.add(country);
      if (typeof entry.lang === 'string' && entry.lang) group.langs.add(entry.lang.toLowerCase());
      for (const source of entry.sources || []) {
        if (source && typeof source.url === 'string' && source.url) {
          const format = typeof source.format === 'string' ? source.format.toUpperCase() : 'XML';
          if (!group.urlsByFormat.has(format)) group.urlsByFormat.set(format, source.url);
        }
      }
    }

    const guides = [];
    for (const group of bySite.values()) {
      guides.push({
        site: group.site,
        url: pickGuideUrl(group.urlsByFormat),
        channelCount: group.channelCount,
        countries: [...group.countries].sort(),
        languages: [...group.langs].sort(),
        sampleChannels: group.names.slice(0, 3),
        searchText: `${group.site} ${group.names.join(' ')}`.toLowerCase(),
      });
    }
    // Eklenebilir (url'i olan) kaynaklar once, sonra kanal sayisina gore.
    guides.sort((a, b) => (b.url ? 1 : 0) - (a.url ? 1 : 0) || b.channelCount - a.channelCount);
    return guides;
  }

  _getGuides() {
    return this._cached('guides', GUIDES_URL, GUIDES_MAX_BYTES, (raw) => {
      if (!Array.isArray(raw)) throw createAppError('EPG_FETCH_FAILED', 'Rehber listesi beklenmeyen formatta');
      return this._aggregateGuides(raw);
    });
  }

  _getCountries() {
    return this._cached('countries', COUNTRIES_URL, COUNTRIES_MAX_BYTES, (raw) => {
      if (!Array.isArray(raw)) throw createAppError('EPG_FETCH_FAILED', 'Ülke listesi beklenmeyen formatta');
      return raw
        .filter((c) => c && typeof c.name === 'string' && typeof c.code === 'string')
        .map((c) => ({ name: c.name, code: c.code.toUpperCase(), flag: typeof c.flag === 'string' ? c.flag : '' }))
        .sort((a, b) => a.name.localeCompare(b.name, 'en'));
    });
  }

  async listCountries() {
    return this._getCountries();
  }

  async listGuides({ country, language, q } = {}) {
    let guides = await this._getGuides();

    if (country) {
      const code = String(country).trim().toUpperCase();
      if (code) guides = guides.filter((g) => g.countries.includes(code));
    }
    if (language) {
      const lang = String(language).trim().toLowerCase();
      if (lang) guides = guides.filter((g) => g.languages.includes(lang));
    }
    if (q) {
      const needle = String(q).trim().toLowerCase();
      if (needle) guides = guides.filter((g) => g.searchText.includes(needle));
    }

    // searchText yalnizca dahili filtreleme icindir, disari sizdirma.
    return guides.map(({ searchText, ...guide }) => guide);
  }

  async resolveGuide(site) {
    if (typeof site !== 'string' || !site.trim()) {
      throw createAppError('VALIDATION_ERROR', 'site parametresi gerekli');
    }
    const guides = await this._getGuides();
    const guide = guides.find((g) => g.site === site.trim());
    if (!guide) throw createAppError('NOT_FOUND', 'Rehber kütüphanede bulunamadı');
    if (!guide.url) throw createAppError('NOT_FOUND', 'Bu site için yayınlanmış hazır rehber URL\'i yok');
    return guide.url;
  }
}

module.exports = EpgLibraryService;
