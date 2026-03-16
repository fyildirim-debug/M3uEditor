const config = require('../config');

const TIMEOUT = 10000;

class TMDBService {
  constructor() {
    this.apiKey = config.tmdb.apiKey;
    this.baseUrl = config.tmdb.baseUrl;
    this.imageBase = config.tmdb.imageBaseUrl;
  }

  get enabled() {
    return !!this.apiKey;
  }

  async _fetch(path, params = {}) {
    if (!this.enabled) return null;

    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set('api_key', this.apiKey);
    url.searchParams.set('language', 'tr-TR');
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    try {
      const res = await fetch(url.toString(), { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  }

  async searchMovie(query, year) {
    const data = await this._fetch('/search/movie', { query, year, include_adult: false });
    return data?.results || [];
  }

  async searchTV(query, year) {
    const data = await this._fetch('/search/tv', { query, first_air_date_year: year, include_adult: false });
    return data?.results || [];
  }

  async getMovieDetails(tmdbId) {
    return this._fetch(`/movie/${tmdbId}`, { append_to_response: 'credits,external_ids' });
  }

  async getTVDetails(tmdbId) {
    return this._fetch(`/tv/${tmdbId}`, { append_to_response: 'credits,external_ids' });
  }

  _posterUrl(path) {
    return path ? `${this.imageBase}/w500${path}` : null;
  }

  _backdropUrl(path) {
    return path ? `${this.imageBase}/w1280${path}` : null;
  }

  _extractCast(credits, limit = 10) {
    if (!credits?.cast) return [];
    return credits.cast.slice(0, limit).map(c => c.name);
  }

  _extractDirector(credits) {
    if (!credits?.crew) return null;
    const dir = credits.crew.find(c => c.job === 'Director');
    return dir?.name || null;
  }

  _extractCreator(credits) {
    if (!credits?.crew) return null;
    const creator = credits.crew.find(c => c.job === 'Executive Producer' || c.department === 'Writing');
    return creator?.name || null;
  }

  /**
   * Film/dizi isminden TMDB'de arama yap ve metadata don.
   * @param {string} name - Film/dizi adi
   * @param {'vod'|'series'} streamType
   * @param {number} [year]
   * @returns {Promise<object|null>}
   */
  async enrichMetadata(name, streamType, year) {
    if (!this.enabled || !name) return null;

    // Xtream isimleri genelde "TR | Film Adi" veya "Film Adi (2024)" formatinda
    const cleanName = name
      .replace(/^[A-Z]{2,3}\s*\|\s*/i, '') // "TR | " prefix
      .replace(/\s*\(\d{4}\)\s*$/, '')      // "(2024)" suffix
      .replace(/\s*\[.*?\]\s*/g, '')        // "[HD]" vb.
      .trim();

    if (!cleanName) return null;

    let details;

    if (streamType === 'vod') {
      const results = await this.searchMovie(cleanName, year);
      if (!results.length) return null;
      details = await this.getMovieDetails(results[0].id);
    } else {
      const results = await this.searchTV(cleanName, year);
      if (!results.length) return null;
      details = await this.getTVDetails(results[0].id);
    }

    if (!details) return null;

    const isMovie = streamType === 'vod';

    return {
      tmdb_id: details.id,
      imdb_id: details.external_ids?.imdb_id || details.imdb_id || null,
      title: isMovie ? details.title : details.name,
      overview: details.overview || null,
      year: isMovie
        ? (details.release_date ? parseInt(details.release_date.slice(0, 4), 10) : null)
        : (details.first_air_date ? parseInt(details.first_air_date.slice(0, 4), 10) : null),
      rating: details.vote_average || null,
      vote_count: details.vote_count || 0,
      genres: (details.genres || []).map(g => g.name),
      cast: this._extractCast(details.credits),
      director: isMovie ? this._extractDirector(details.credits) : this._extractCreator(details.credits),
      runtime: isMovie ? (details.runtime || null) : (details.episode_run_time?.[0] || null),
      poster_url: this._posterUrl(details.poster_path),
      backdrop_url: this._backdropUrl(details.backdrop_path),
      seasons: !isMovie ? (details.number_of_seasons || null) : undefined,
      episodes: !isMovie ? (details.number_of_episodes || null) : undefined,
      metadata_fetched: true,
    };
  }
}

module.exports = new TMDBService();
