const { createAppError } = require('../utils/AppError');

const DEFAULT_TIMEOUT = 120000; // 120 saniye - büyük kanal listeleri için
const MAX_RETRIES = 3; // Retry sayısı (toplam 4 deneme)
const BASE_DELAY = 2000; // 2 saniye (exponential backoff başlangıcı)

/**
 * Xtream Codes API istemcisi.
 * Timeout, retry ve tüm stream tipleri (live, VOD, series) desteği içerir.
 */
class XtreamClient {
  /**
   * @param {string} serverUrl - Xtream sunucu base URL
   * @param {string} username - API kullanıcı adı
   * @param {string} password - API şifresi
   * @param {object} [options] - Opsiyonel yapılandırma
   * @param {number} [options.timeout] - İstek timeout ms (varsayılan: 60000)
   * @param {number} [options.maxRetries] - Maksimum retry sayısı (varsayılan: 2)
   * @param {number} [options.baseDelay] - Exponential backoff başlangıç gecikmesi ms (varsayılan: 1000)
   */
  constructor(serverUrl, username, password, options = {}) {
    this.serverUrl = serverUrl.replace(/\/+$/, '');
    this.username = username;
    this.password = password;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = options.maxRetries ?? MAX_RETRIES;
    this.baseDelay = options.baseDelay ?? BASE_DELAY;
  }

  /**
   * API URL'si oluştur.
   * @param {Record<string, string>} [extraParams] - Ek query parametreleri
   * @returns {string}
   */
  _buildUrl(extraParams = {}) {
    const params = new URLSearchParams({
      username: this.username,
      password: this.password,
      ...extraParams,
    });
    return `${this.serverUrl}/player_api.php?${params.toString()}`;
  }

  /**
   * Timeout ve exponential backoff retry ile fetch.
   * @param {string} url
   * @returns {Promise<any>} Parse edilmiş JSON yanıtı
   */
  async _fetchWithRetry(url) {
    let lastError;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
      } catch (err) {
        lastError = err;

        // Son denemede retry yapma
        if (attempt < this.maxRetries - 1) {
          const delay = this.baseDelay * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // Tüm denemeler tükendi
    if (lastError && lastError.name === 'AbortError') {
      throw createAppError('XTREAM_CONNECTION_FAILED', 'Xtream API bağlantı zaman aşımına uğradı');
    }
    throw createAppError('XTREAM_CONNECTION_FAILED', lastError?.message || 'Xtream API bağlantı hatası');
  }

  /**
   * Xtream Codes API ile kimlik doğrulama.
   * @returns {Promise<{ serverInfo: object }>}
   */
  async authenticate() {
    const url = this._buildUrl();
    const data = await this._fetchWithRetry(url);

    if (!data || !data.user_info || !data.server_info) {
      throw createAppError('XTREAM_AUTH_FAILED', 'Xtream API kimlik doğrulama başarısız');
    }

    if (data.user_info.auth === 0) {
      throw createAppError('XTREAM_AUTH_FAILED', 'Xtream API kimlik bilgileri geçersiz');
    }

    return { serverInfo: data.server_info };
  }

  /**
   * Canlı TV kategorileri getir.
   * @returns {Promise<Array<{ category_id: string, category_name: string }>>}
   */
  async getLiveCategories() {
    const url = this._buildUrl({ action: 'get_live_categories' });
    const data = await this._fetchWithRetry(url);
    return Array.isArray(data) ? data : [];
  }

  /**
   * Canlı TV stream listesi getir.
   * @param {string} [categoryId] - Opsiyonel kategori filtresi
   * @returns {Promise<Array>}
   */
  async getLiveStreams(categoryId) {
    const params = { action: 'get_live_streams' };
    if (categoryId !== undefined && categoryId !== null) {
      params.category_id = categoryId;
    }
    const url = this._buildUrl(params);
    const data = await this._fetchWithRetry(url);
    return Array.isArray(data) ? data : [];
  }

  /**
   * VOD kategorileri getir.
   * @returns {Promise<Array<{ category_id: string, category_name: string }>>}
   */
  async getVodCategories() {
    const url = this._buildUrl({ action: 'get_vod_categories' });
    try {
      const data = await this._fetchWithRetry(url);
      return Array.isArray(data) ? data : [];
    } catch {
      // VOD desteklenmiyorsa boş dön
      return [];
    }
  }

  /**
   * VOD stream listesi getir.
   * @param {string} [categoryId] - Opsiyonel kategori filtresi
   * @returns {Promise<Array>}
   */
  async getVodStreams(categoryId) {
    const params = { action: 'get_vod_streams' };
    if (categoryId !== undefined && categoryId !== null) {
      params.category_id = categoryId;
    }
    const url = this._buildUrl(params);
    try {
      const data = await this._fetchWithRetry(url);
      return Array.isArray(data) ? data : [];
    } catch {
      // VOD desteklenmiyorsa boş dön
      return [];
    }
  }

  /**
   * Dizi kategorileri getir.
   * @returns {Promise<Array<{ category_id: string, category_name: string }>>}
   */
  async getSeriesCategories() {
    const url = this._buildUrl({ action: 'get_series_categories' });
    try {
      const data = await this._fetchWithRetry(url);
      return Array.isArray(data) ? data : [];
    } catch {
      // Series desteklenmiyorsa boş dön
      return [];
    }
  }

  /**
   * Dizi listesi getir.
   * @param {string} [categoryId] - Opsiyonel kategori filtresi
   * @returns {Promise<Array>}
   */
  async getSeriesStreams(categoryId) {
    const params = { action: 'get_series' };
    if (categoryId !== undefined && categoryId !== null) {
      params.category_id = categoryId;
    }
    const url = this._buildUrl(params);
    try {
      const data = await this._fetchWithRetry(url);
      return Array.isArray(data) ? data : [];
    } catch {
      // Series desteklenmiyorsa boş dön
      return [];
    }
  }

  /**
   * Tüm kanalları getir: kategori bazlı çekerek sağlayıcı limitini aş.
   * @param {string[]} [streamTypes=['live']] - Çekilecek tipler: 'live', 'vod', 'series'
   * @returns {Promise<{ categories: Array, channels: Array }>}
   */
  async getAllChannels(streamTypes = ['live']) {
    const allCategories = [];
    const allChannels = [];

    // Live TV
    if (streamTypes.includes('live')) {
      const liveCats = await this.getLiveCategories();
      for (const cat of liveCats) {
        allCategories.push({ category_id: cat.category_id, category_name: cat.category_name });
        const streams = await this.getLiveStreams(cat.category_id);
        for (const stream of streams) {
          allChannels.push({
            stream_id: stream.stream_id,
            name: stream.name,
            stream_icon: stream.stream_icon || null,
            epg_channel_id: stream.epg_channel_id || null,
            category_id: stream.category_id || null,
            stream_type: 'live',
            container_extension: 'ts',
          });
        }
      }
    }

    // VOD (Filmler)
    if (streamTypes.includes('vod')) {
      const vodCats = await this.getVodCategories();
      for (const cat of vodCats) {
        allCategories.push({
          category_id: `vod_${cat.category_id}`,
          category_name: `VOD | ${cat.category_name}`,
        });
        const streams = await this.getVodStreams(cat.category_id);
        for (const stream of streams) {
          allChannels.push({
            stream_id: stream.stream_id,
            name: stream.name,
            stream_icon: stream.stream_icon || null,
            epg_channel_id: null,
            category_id: `vod_${stream.category_id || cat.category_id}`,
            stream_type: 'vod',
            container_extension: stream.container_extension || 'mp4',
            rating: stream.rating || null,
            genre: stream.genre || null,
            plot: stream.plot || null,
            year: stream.year || stream.releaseDate?.slice(0, 4) || null,
            tmdb_id: stream.tmdb_id || null,
          });
        }
      }
    }

    // Series (Diziler)
    if (streamTypes.includes('series')) {
      const seriesCats = await this.getSeriesCategories();
      for (const cat of seriesCats) {
        allCategories.push({
          category_id: `series_${cat.category_id}`,
          category_name: `Series | ${cat.category_name}`,
        });
        const streams = await this.getSeriesStreams(cat.category_id);
        for (const stream of streams) {
          allChannels.push({
            stream_id: stream.series_id || stream.stream_id,
            name: stream.name,
            stream_icon: stream.cover || stream.stream_icon || null,
            epg_channel_id: null,
            category_id: `series_${stream.category_id || cat.category_id}`,
            stream_type: 'series',
            container_extension: stream.container_extension || 'mp4',
            rating: stream.rating || null,
            genre: stream.genre || null,
            plot: stream.plot || null,
            year: stream.year || stream.releaseDate?.slice(0, 4) || null,
            tmdb_id: stream.tmdb_id || null,
          });
        }
      }
    }

    return { categories: allCategories, channels: allChannels };
  }

  /**
   * VOD (film) detay bilgisi getir.
   * @param {string} vodId
   * @returns {Promise<object|null>}
   */
  async getVodInfo(vodId) {
    try {
      return await this._fetchWithRetry(this._buildUrl({ action: 'get_vod_info', vod_id: vodId }));
    } catch { return null; }
  }

  /**
   * Dizi detay bilgisi getir.
   * @param {string} seriesId
   * @returns {Promise<object|null>}
   */
  async getSeriesInfo(seriesId) {
    try {
      return await this._fetchWithRetry(this._buildUrl({ action: 'get_series_info', series_id: seriesId }));
    } catch { return null; }
  }
}

module.exports = XtreamClient;
