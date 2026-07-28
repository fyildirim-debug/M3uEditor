const { createAppError } = require('../utils/AppError');
const config = require('../config');
const { safeFetchJson, parseRemoteUrl } = require('../utils/safeFetch');

const DEFAULT_TIMEOUT = 120000; // Geriye dönük yapılandırma yedeği
const MAX_RETRIES = 3; // Toplam deneme sayısı (1 ilk deneme + 2 yeniden deneme)
const BASE_DELAY = 2000; // 2 saniye (exponential backoff başlangıcı)

// Yeniden denemenin sonucu değiştirmeyeceği hatalar: istek/adres kalıcı olarak geçersiz.
const NON_RETRYABLE_CODES = new Set([
  'VALIDATION_ERROR',
  'FORBIDDEN',
  'IMPORT_CANCELLED',
  'IMPORT_IN_PROGRESS',
]);
const RETRYABLE_REMOTE_STATUSES = new Set([408, 425, 429]);

function cancellationError(signal) {
  if (signal?.reason?.statusCode) return signal.reason;
  const error = createAppError('IMPORT_CANCELLED');
  error.name = 'AbortError';
  return error;
}

function isCancellation(error) {
  return error?.code === 'IMPORT_CANCELLED' || error?.name === 'AbortError';
}

function isTerminalBudgetError(error) {
  return isCancellation(error) || error?.budgetExhausted === true;
}

/**
 * Aynı istek tekrarlandığında farklı bir sonuç verme ihtimali var mı?
 * 4xx yanıtlarının yalnızca geçici kabul edilen 408/425/429 türleri yeniden denenir.
 * @param {Error & { code?: string, remoteStatus?: number }} error
 * @returns {boolean}
 */
function isRetryable(error) {
  if (!error) return false;
  if (isTerminalBudgetError(error)) return false;
  if (NON_RETRYABLE_CODES.has(error.code)) return false;
  const status = error.remoteStatus;
  if (typeof status === 'number' && status >= 400 && status < 500 && !RETRYABLE_REMOTE_STATUSES.has(status)) return false;
  return true;
}

async function mapWithConcurrency(items, concurrency, worker, signal) {
  if (!items.length) return [];
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      if (signal?.aborted) throw cancellationError(signal);
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }));

  return results;
}

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
   * @param {number} [options.timeout] - Tüm istemci çağrıları için toplam süre bütçesi (varsayılan: 120000)
   * @param {number} [options.maxRetries] - Toplam deneme sayısı (varsayılan: 3)
   * @param {number} [options.baseDelay] - Exponential backoff başlangıç gecikmesi ms (varsayılan: 2000)
   * @param {{ remaining: number }} [options.byteBudget] - Tüm çağrıların paylaştığı bayt sayacı
   * @param {AbortSignal} [options.signal] - İşi ve etkin uzak istekleri iptal eder
   */
  constructor(serverUrl, username, password, options = {}) {
    this.serverUrl = parseRemoteUrl(serverUrl).toString().replace(/\/+$/, '');
    this.username = username;
    this.password = password;
    this.timeout = options.timeout ?? config.xtream.totalTimeoutMs ?? DEFAULT_TIMEOUT;
    this.maxRetries = options.maxRetries ?? MAX_RETRIES;
    this.baseDelay = options.baseDelay ?? BASE_DELAY;
    this.maxBytes = options.maxBytes ?? config.limits.xtreamBytes;
    this.deadline = options.deadline ?? Date.now() + this.timeout;
    this.byteBudget = typeof options.byteBudget === 'number'
      ? { remaining: options.byteBudget }
      : options.byteBudget ?? { remaining: this.maxBytes };
    this.signal = options.signal;
  }

  _budgetError() {
    const error = createAppError('XTREAM_CONNECTION_FAILED', 'Xtream API toplam istek bütçesi tükendi');
    error.budgetExhausted = true;
    error.budgetType = this.byteBudget.remaining <= 0 ? 'bytes' : 'deadline';
    return error;
  }

  _assertActive() {
    if (this.signal?.aborted) throw cancellationError(this.signal);
    if (Date.now() >= this.deadline || this.byteBudget.remaining <= 0) throw this._budgetError();
  }

  async _waitBeforeRetry(delay) {
    this._assertActive();
    if (delay <= 0) return;
    const remaining = this.deadline - Date.now();
    if (delay >= remaining) throw this._budgetError();

    await new Promise((resolve, reject) => {
      const onAbort = () => {
        clearTimeout(timer);
        this.signal?.removeEventListener('abort', onAbort);
        reject(cancellationError(this.signal));
      };
      const timer = setTimeout(() => {
        this.signal?.removeEventListener('abort', onAbort);
        resolve();
      }, delay);
      this.signal?.addEventListener('abort', onAbort, { once: true });
    });
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
        this._assertActive();
        const response = await safeFetchJson(url, {
          timeoutMs: this.timeout,
          maxBytes: this.maxBytes,
          deadline: this.deadline,
          byteBudget: this.byteBudget,
          signal: this.signal,
        });
        return response.data;
      } catch (err) {
        lastError = err;

        if (isTerminalBudgetError(err)) throw err;

        // Kalıcı hatalarda (geçersiz adres, 4xx) tekrar denemek anlamsız
        if (!isRetryable(err)) break;

        // Son denemede retry yapma
        if (attempt < this.maxRetries - 1) {
          const delay = this.baseDelay * Math.pow(2, attempt);
          await this._waitBeforeRetry(delay);
        }
      }
    }

    // Tüm denemeler tükendi
    if (isTerminalBudgetError(lastError)) throw lastError;
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
  async getVodCategories(suppressErrors = true) {
    const url = this._buildUrl({ action: 'get_vod_categories' });
    try {
      const data = await this._fetchWithRetry(url);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      if (isTerminalBudgetError(error)) throw error;
      // VOD desteklenmiyorsa boş dön
      if (suppressErrors) return [];
      throw error;
    }
  }

  /**
   * VOD stream listesi getir.
   * @param {string} [categoryId] - Opsiyonel kategori filtresi
   * @returns {Promise<Array>}
   */
  async getVodStreams(categoryId, suppressErrors = true) {
    const params = { action: 'get_vod_streams' };
    if (categoryId !== undefined && categoryId !== null) {
      params.category_id = categoryId;
    }
    const url = this._buildUrl(params);
    try {
      const data = await this._fetchWithRetry(url);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      if (isTerminalBudgetError(error)) throw error;
      // VOD desteklenmiyorsa boş dön
      if (suppressErrors) return [];
      throw error;
    }
  }

  /**
   * Dizi kategorileri getir.
   * @returns {Promise<Array<{ category_id: string, category_name: string }>>}
   */
  async getSeriesCategories(suppressErrors = true) {
    const url = this._buildUrl({ action: 'get_series_categories' });
    try {
      const data = await this._fetchWithRetry(url);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      if (isTerminalBudgetError(error)) throw error;
      // Series desteklenmiyorsa boş dön
      if (suppressErrors) return [];
      throw error;
    }
  }

  /**
   * Dizi listesi getir.
   * @param {string} [categoryId] - Opsiyonel kategori filtresi
   * @returns {Promise<Array>}
   */
  async getSeriesStreams(categoryId, suppressErrors = true) {
    const params = { action: 'get_series' };
    if (categoryId !== undefined && categoryId !== null) {
      params.category_id = categoryId;
    }
    const url = this._buildUrl(params);
    try {
      const data = await this._fetchWithRetry(url);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      if (isTerminalBudgetError(error)) throw error;
      // Series desteklenmiyorsa boş dön
      if (suppressErrors) return [];
      throw error;
    }
  }

  async _getStreamsFast(categories, getStreams, getStreamId, optional = false) {
    let bulkStreams = [];
    let bulkError = null;

    try {
      const result = await getStreams();
      bulkStreams = Array.isArray(result) ? result : [];
    } catch (error) {
      if (isTerminalBudgetError(error)) throw error;
      bulkError = error;
    }

    const coveredCategoryIds = new Set(
      bulkStreams
        .map((stream) => stream.category_id)
        .filter((categoryId) => categoryId !== undefined && categoryId !== null)
        .map(String)
    );
    const fallbackCategories = bulkStreams.length
      ? categories.filter((category) => !coveredCategoryIds.has(String(category.category_id)))
      : categories;

    if (!fallbackCategories.length) {
      if (bulkError && !optional) throw bulkError;
      return bulkStreams;
    }

    const outcomes = await mapWithConcurrency(
      fallbackCategories,
      config.xtream.categoryConcurrency,
      async (category) => {
        try {
          const result = await getStreams(category.category_id);
          const streams = Array.isArray(result)
            ? result.map((stream) => (
              stream.category_id === undefined || stream.category_id === null
                ? { ...stream, category_id: category.category_id }
                : stream
            ))
            : [];
          return { streams, error: null };
        } catch (error) {
          if (isTerminalBudgetError(error)) throw error;
          return { streams: [], error };
        }
      },
      this.signal
    );
    const fallbackError = outcomes.find((outcome) => outcome.error)?.error;
    if (fallbackError) throw fallbackError;

    const uniqueStreams = new Map();
    for (const stream of [...bulkStreams, ...outcomes.flatMap((outcome) => outcome.streams)]) {
      const streamId = getStreamId(stream);
      const key = streamId === undefined || streamId === null
        ? `${stream.category_id || ''}:${stream.name || ''}:${uniqueStreams.size}`
        : String(streamId);
      if (!uniqueStreams.has(key)) uniqueStreams.set(key, stream);
    }

    if (!uniqueStreams.size && bulkError && !optional) throw bulkError;
    return [...uniqueStreams.values()];
  }

  async _getLivePayload() {
    const categories = await this.getLiveCategories();
    const streams = await this._getStreamsFast(categories, (categoryId) => this.getLiveStreams(categoryId), (stream) => stream.stream_id);
    return {
      categories: categories.map((category) => ({ category_id: category.category_id, category_name: category.category_name })),
      channels: streams.map((stream) => ({
        stream_id: stream.stream_id,
        name: stream.name,
        stream_icon: stream.stream_icon || null,
        epg_channel_id: stream.epg_channel_id || null,
        category_id: stream.category_id ?? null,
        stream_type: 'live',
        container_extension: 'ts',
      })),
    };
  }

  async _getVodPayload() {
    const categories = await this.getVodCategories(false);
    const streams = await this._getStreamsFast(categories, (categoryId) => this.getVodStreams(categoryId, false), (stream) => stream.stream_id);
    return {
      categories: categories.map((category) => ({ category_id: `vod_${category.category_id}`, category_name: `VOD | ${category.category_name}` })),
      channels: streams.map((stream) => ({
        stream_id: stream.stream_id,
        name: stream.name,
        stream_icon: stream.stream_icon || null,
        epg_channel_id: null,
        category_id: stream.category_id === undefined || stream.category_id === null ? null : `vod_${stream.category_id}`,
        stream_type: 'vod',
        container_extension: stream.container_extension || 'mp4',
        rating: stream.rating || null,
        genre: stream.genre || null,
        plot: stream.plot || null,
        year: stream.year || stream.releaseDate?.slice(0, 4) || null,
        tmdb_id: stream.tmdb_id || null,
      })),
    };
  }

  async _getSeriesPayload() {
    const categories = await this.getSeriesCategories(false);
    const streams = await this._getStreamsFast(categories, (categoryId) => this.getSeriesStreams(categoryId, false), (stream) => stream.series_id || stream.stream_id);
    return {
      categories: categories.map((category) => ({ category_id: `series_${category.category_id}`, category_name: `Series | ${category.category_name}` })),
      channels: streams.map((stream) => ({
        stream_id: stream.series_id || stream.stream_id,
        name: stream.name,
        stream_icon: stream.cover || stream.stream_icon || null,
        epg_channel_id: null,
        category_id: stream.category_id === undefined || stream.category_id === null ? null : `series_${stream.category_id}`,
        stream_type: 'series',
        container_extension: stream.container_extension || 'mp4',
        rating: stream.rating || null,
        genre: stream.genre || null,
        plot: stream.plot || null,
        year: stream.year || stream.releaseDate?.slice(0, 4) || null,
        tmdb_id: stream.tmdb_id || null,
      })),
    };
  }

  /**
   * Tek bir içerik türünü çeker ve sonucu her zaman açık bir tamamlanma durumuyla
   * döndürür. Hata yutulmaz: başarısız tür `failed` olarak işaretlenir ki çağıran
   * taraf o türü "sağlayıcıda artık yok" sanıp mevcut kayıtları silmesin.
   * @param {'live'|'vod'|'series'} type
   * @returns {Promise<{ type: string, status: 'complete'|'failed', categories: Array, channels: Array, error: Error|null }>}
   */
  async _getTypePayload(type) {
    const loaders = {
      live: () => this._getLivePayload(),
      vod: () => this._getVodPayload(),
      series: () => this._getSeriesPayload(),
    };

    try {
      const payload = await loaders[type]();
      return {
        type,
        status: payload?.status || 'complete',
        categories: payload?.categories || [],
        channels: payload?.channels || [],
        error: null,
      };
    } catch (error) {
      if (isTerminalBudgetError(error)) throw error;
      return { type, status: 'failed', categories: [], channels: [], error };
    }
  }

  /**
   * Tüm kanalları getir. Önce her içerik türünün toplu endpoint'ini kullanır;
   * sağlayıcı eksik kategori döndürürse yalnızca eksik kategorileri kontrollü
   * paralellikle tamamlar.
   *
   * Dönen `types` alanı her tür için tamamlanma durumunu taşır. Yalnızca
   * `complete` türlerin verisi `categories`/`channels` içinde yer alır; böylece
   * geçici bir tür hatası, çağıranın o türe ait mevcut kayıtları bayat sayıp
   * silmesine yol açamaz. Seçilen türlerin tamamı başarısızsa hata fırlatılır.
   *
   * @param {string[]} [streamTypes=['live']] - Çekilecek tipler: 'live', 'vod', 'series'
   * @returns {Promise<{ categories: Array, channels: Array, types: Array<{ type: string, status: string, error: string|null }> }>}
   */
  async getAllChannels(streamTypes = ['live']) {
    const selectedTypes = ['live', 'vod', 'series'].filter((type) => streamTypes.includes(type));
    const payloads = await mapWithConcurrency(
      selectedTypes,
      config.xtream.typeConcurrency,
      (type) => this._getTypePayload(type),
      this.signal
    );

    const completed = payloads.filter((payload) => payload.status === 'complete');
    if (selectedTypes.length > 0 && completed.length === 0) {
      throw payloads.find((payload) => payload.error)?.error
        || createAppError('XTREAM_CONNECTION_FAILED', 'Seçilen içerik türlerinin hiçbiri alınamadı');
    }

    return {
      categories: completed.flatMap((payload) => payload.categories),
      channels: completed.flatMap((payload) => payload.channels),
      types: payloads.map((payload) => ({
        type: payload.type,
        status: payload.status,
        error: payload.error?.message || null,
      })),
    };
  }

  /**
   * Xtream Codes XMLTV EPG URL'sini döndür.
   * @returns {string} XMLTV formatında EPG URL'si
   */
  getXmltvUrl() {
    return `${this.serverUrl}/xmltv.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`;
  }

  buildStreamUrl(streamType, streamId, extension = 'ts') {
    const pathType = streamType === 'vod' ? 'movie' : streamType === 'series' ? 'series' : 'live';
    return `${this.serverUrl}/${pathType}/${encodeURIComponent(this.username)}/${encodeURIComponent(this.password)}/${encodeURIComponent(streamId)}.${encodeURIComponent(extension)}`;
  }

  /**
   * VOD (film) detay bilgisi getir.
   * @param {string} vodId
   * @returns {Promise<object|null>}
   */
  async getVodInfo(vodId) {
    try {
      return await this._fetchWithRetry(this._buildUrl({ action: 'get_vod_info', vod_id: vodId }));
    } catch (error) {
      if (isTerminalBudgetError(error)) throw error;
      return null;
    }
  }

  /**
   * Dizi detay bilgisi getir.
   * @param {string} seriesId
   * @returns {Promise<object|null>}
   */
  async getSeriesInfo(seriesId) {
    try {
      return await this._fetchWithRetry(this._buildUrl({ action: 'get_series_info', series_id: seriesId }));
    } catch (error) {
      if (isTerminalBudgetError(error)) throw error;
      return null;
    }
  }
}

module.exports = XtreamClient;
