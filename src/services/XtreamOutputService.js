const crypto = require('crypto');
const db = require('../config/database');
const { hashToken, encrypt, decrypt } = require('../utils/crypto');
const { createAppError } = require('../utils/AppError');
const exportService = require('./ExportService');
const xmltvExportService = require('./XMLTVExportService');
const { toAbsoluteMediaUrl } = require('../utils/urls');
const config = require('../config');

const USERNAME_BYTES = 12;
const PASSWORD_BYTES = 24;
const MAX_CREDENTIAL_ATTEMPTS = 5;
const MAX_EPG_LIMIT = 1000;
const DUMMY_HASH = hashToken('xtream-output-invalid-credential');

function appUrl() {
  return config.appUrl;
}

function randomCredential(byteLength) {
  return crypto.randomBytes(byteLength).toString('base64url');
}

function validStoredHash(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value) ? value : DUMMY_HASH;
}

function timingSafeHashMatch(value, expectedHash) {
  const actual = Buffer.from(hashToken(String(value ?? '')), 'hex');
  const expected = Buffer.from(validStoredHash(expectedHash), 'hex');
  return crypto.timingSafeEqual(actual, expected);
}

function parseExtras(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function numericXtreamId(value) {
  const asString = String(value ?? '');
  if (!/^\d{1,19}$/.test(asString) || asString === '0') return null;
  if (BigInt(asString) > 9223372036854775807n) return null;
  const asNumber = Number(asString);
  return Number.isSafeInteger(asNumber) ? asNumber : asString;
}

function categoryId(value) {
  return value === null || value === undefined ? '0' : String(value);
}

function unixSeconds(value) {
  const milliseconds = value ? new Date(value).getTime() : Date.now();
  return String(Math.floor((Number.isFinite(milliseconds) ? milliseconds : Date.now()) / 1000));
}

function ratingValues(extras) {
  const rawRating = extras.rating ?? '';
  const parsedRating = Number.parseFloat(rawRating);
  const rating = Number.isFinite(parsedRating) ? String(parsedRating) : '';
  const fiveBased = Number.isFinite(parsedRating)
    ? String(Math.round((parsedRating / 2) * 10) / 10)
    : String(extras.rating_5based ?? '');
  return { rating, rating_5based: fiveBased };
}

function containerExtension(channel) {
  const extras = parseExtras(channel.extras);
  const explicit = extras.container_extension || extras.containerExtension;
  if (typeof explicit === 'string' && /^[a-z0-9]{1,10}$/i.test(explicit)) return explicit.toLowerCase();

  try {
    const match = new URL(channel.stream_url).pathname.match(/\.([a-z0-9]{1,10})$/i);
    if (match) return match[1].toLowerCase();
  } catch (_error) {
    // A stream URL may use a provider-specific scheme; fall back by media type.
  }
  return channel.stream_type === 'live' ? 'ts' : 'mp4';
}

function formatDateTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function encodeEpgText(value) {
  return Buffer.from(String(value || ''), 'utf8').toString('base64');
}

class XtreamOutputService {
  _endpointUrl(path, username, password, extraParams = {}) {
    const url = new URL(path, `${appUrl()}/`);
    if (username) url.searchParams.set('username', username);
    if (password !== undefined) url.searchParams.set('password', password);
    for (const [key, value] of Object.entries(extraParams)) url.searchParams.set(key, value);
    return url.toString();
  }

  _urls(username, password) {
    return {
      serverUrl: appUrl(),
      playerApiUrl: this._endpointUrl('/player_api.php', username, password),
      xmltvUrl: this._endpointUrl('/xmltv.php', username, password),
      m3uUrl: this._endpointUrl('/get.php', username, password, { type: 'm3u_plus', output: 'ts' }),
    };
  }

  async _ownedPlaylist(userId, playlistId) {
    const playlist = await db('playlists').where({ id: playlistId, user_id: userId }).first();
    if (!playlist) throw createAppError('NOT_FOUND');
    return playlist;
  }

  async getConfiguration(userId, playlistId) {
    const playlist = await this._ownedPlaylist(userId, playlistId);
    // Sifre kullaniciya acik gosterilir; yalnizca enc kolonu olmayan eski
    // kayitlarda null doner (bir kez sifirlayinca dolar).
    const password = playlist.output_password_enc ? decrypt(playlist.output_password_enc) : null;
    return {
      enabled: Boolean(playlist.output_enabled),
      username: playlist.output_username || null,
      password,
      ...this._urls(playlist.output_username || null, password ?? undefined),
      createdAt: playlist.output_created_at || null,
    };
  }

  async _rotate(userId, playlistId, regeneratePasswordOnly) {
    const playlist = await this._ownedPlaylist(userId, playlistId);

    for (let attempt = 0; attempt < MAX_CREDENTIAL_ATTEMPTS; attempt += 1) {
      const username = regeneratePasswordOnly && playlist.output_username
        ? playlist.output_username
        : randomCredential(USERNAME_BYTES);
      const password = randomCredential(PASSWORD_BYTES);

      try {
        const rows = await db('playlists')
          .where({ id: playlistId, user_id: userId })
          .update({
            output_username: username,
            output_password_hash: hashToken(password),
            output_password_enc: encrypt(password),
            output_enabled: true,
            output_created_at: db.fn.now(),
            updated_at: db.fn.now(),
          })
          .returning(['id']);
        if (!rows.length) throw createAppError('NOT_FOUND');

        return {
          enabled: true,
          username,
          password,
          ...this._urls(username, password),
        };
      } catch (error) {
        if (error.code !== '23505' || regeneratePasswordOnly || attempt === MAX_CREDENTIAL_ATTEMPTS - 1) throw error;
      }
    }

    throw createAppError('INTERNAL_ERROR');
  }

  enable(userId, playlistId) {
    return this._rotate(userId, playlistId, false);
  }

  regenerate(userId, playlistId) {
    return this._rotate(userId, playlistId, true);
  }

  async disable(userId, playlistId) {
    await this._ownedPlaylist(userId, playlistId);
    const updated = await db('playlists')
      .where({ id: playlistId, user_id: userId })
      .update({ output_enabled: false, updated_at: db.fn.now() });
    if (!updated) throw createAppError('NOT_FOUND');
    return { enabled: false };
  }

  async authenticate(username, password) {
    const normalizedUsername = typeof username === 'string' && username.length <= 256 ? username : '';
    const playlist = normalizedUsername
      ? await db('playlists').where({ output_username: normalizedUsername }).first()
      : null;

    // Compare both credential components by fixed-size hashes. The dummy hashes
    // keep the same comparison shape when a username is unknown or data is bad.
    const usernameMatches = timingSafeHashMatch(
      normalizedUsername,
      playlist?.output_username ? hashToken(playlist.output_username) : DUMMY_HASH
    );
    const passwordMatches = timingSafeHashMatch(password, playlist?.output_password_hash || DUMMY_HASH);

    if (playlist && usernameMatches && !playlist.output_enabled) {
      return { status: 'disabled', playlist: null };
    }
    if (!playlist || !usernameMatches || !passwordMatches) {
      return { status: 'invalid', playlist: null };
    }
    return { status: 'valid', playlist };
  }

  accountResponse(playlist, username, password) {
    const base = new URL(appUrl());
    const now = new Date();
    const protocol = base.protocol.replace(':', '');
    const timezone = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    return {
      user_info: {
        username,
        // Xtream clients require this echo even though the server only stores a hash.
        password,
        auth: 1,
        status: 'Active',
        is_trial: '0',
        active_cons: '0',
        max_connections: '1',
        allowed_output_formats: ['ts', 'm3u8'],
        exp_date: null,
        created_at: unixSeconds(playlist.output_created_at),
      },
      server_info: {
        url: base.hostname,
        port: base.port || (protocol === 'http' ? '80' : '443'),
        https_port: protocol === 'https' ? (base.port || '443') : '443',
        server_protocol: protocol,
        rtmp_port: '0',
        timezone,
        timestamp_now: Math.floor(now.getTime() / 1000),
        time_now: formatDateTime(now),
      },
    };
  }

  async getCategories(playlistId, streamType) {
    const rows = await db('categories')
      .join('channels', 'channels.category_id', 'categories.id')
      .where({
        'categories.playlist_id': playlistId,
        'categories.is_hidden': false,
        'channels.playlist_id': playlistId,
        'channels.stream_type': streamType,
      })
      .distinct('categories.xtream_id', 'categories.name', 'categories.sort_order')
      .orderBy('categories.sort_order', 'asc')
      .orderBy('categories.xtream_id', 'asc');

    return rows.map((row) => ({
      category_id: String(row.xtream_id),
      category_name: row.name,
      parent_id: 0,
    }));
  }

  async _streamRows(playlistId, streamType, requestedCategoryId) {
    let query = db('channels')
      .leftJoin('categories', 'channels.category_id', 'categories.id')
      .where({ 'channels.playlist_id': playlistId, 'channels.stream_type': streamType })
      .where(function () {
        this.whereNull('channels.category_id').orWhere('categories.is_hidden', false);
      });

    if (requestedCategoryId !== undefined && requestedCategoryId !== null && requestedCategoryId !== '') {
      if (String(requestedCategoryId) === '0') query = query.whereNull('channels.category_id');
      else if (numericXtreamId(requestedCategoryId) === null) return [];
      else query = query.where('categories.xtream_id', String(requestedCategoryId));
    }

    return query.select(
      'channels.xtream_id',
      'channels.name',
      'channels.logo_url',
      'channels.epg_channel_id',
      'channels.stream_url',
      'channels.extras',
      'channels.created_at',
      'channels.sort_order',
      'channels.stream_type',
      'categories.xtream_id as category_xtream_id'
    )
      .orderByRaw('COALESCE(categories.sort_order, 2147483647) ASC')
      .orderBy('channels.sort_order', 'asc')
      .orderBy('channels.xtream_id', 'asc');
  }

  async getLiveStreams(playlistId, requestedCategoryId) {
    const rows = await this._streamRows(playlistId, 'live', requestedCategoryId);
    return rows.map((row, index) => ({
      num: index + 1,
      name: row.name,
      stream_type: 'live',
      stream_id: numericXtreamId(row.xtream_id),
      stream_icon: toAbsoluteMediaUrl(row.logo_url) || '',
      epg_channel_id: row.epg_channel_id || '',
      added: unixSeconds(row.created_at),
      category_id: categoryId(row.category_xtream_id),
      custom_sid: '',
      tv_archive: 0,
      direct_source: '',
      tv_archive_duration: 0,
    }));
  }

  async getVodStreams(playlistId, requestedCategoryId) {
    const rows = await this._streamRows(playlistId, 'vod', requestedCategoryId);
    return rows.map((row, index) => {
      const extras = parseExtras(row.extras);
      return {
        num: index + 1,
        name: row.name,
        stream_type: 'movie',
        stream_id: numericXtreamId(row.xtream_id),
        stream_icon: toAbsoluteMediaUrl(row.logo_url || extras.poster_url) || '',
        ...ratingValues(extras),
        added: unixSeconds(row.created_at),
        category_id: categoryId(row.category_xtream_id),
        container_extension: containerExtension(row),
        custom_sid: '',
        direct_source: '',
      };
    });
  }

  async getSeries(playlistId, requestedCategoryId) {
    const rows = await this._streamRows(playlistId, 'series', requestedCategoryId);
    return rows.map((row, index) => {
      const extras = parseExtras(row.extras);
      return {
        num: index + 1,
        name: row.name,
        series_id: numericXtreamId(row.xtream_id),
        cover: toAbsoluteMediaUrl(row.logo_url || extras.poster_url) || '',
        plot: extras.plot || extras.overview || '',
        cast: extras.cast || '',
        director: extras.director || '',
        genre: extras.genre || '',
        releaseDate: extras.releaseDate || extras.releasedate || (extras.year ? String(extras.year) : ''),
        last_modified: unixSeconds(row.created_at),
        ...ratingValues(extras),
        category_id: categoryId(row.category_xtream_id),
      };
    });
  }

  async _channelByXtreamId(playlistId, streamType, value) {
    const id = numericXtreamId(value);
    if (id === null) throw createAppError('NOT_FOUND');
    const row = await db('channels')
      .leftJoin('categories', 'channels.category_id', 'categories.id')
      .where({
        'channels.playlist_id': playlistId,
        'channels.stream_type': streamType,
        'channels.xtream_id': String(id),
      })
      .where(function () {
        this.whereNull('channels.category_id').orWhere('categories.is_hidden', false);
      })
      .select(
        'channels.*',
        'categories.xtream_id as category_xtream_id',
        'categories.name as category_name'
      )
      .first();
    if (!row) throw createAppError('NOT_FOUND');
    return row;
  }

  async getVodInfo(playlistId, vodId) {
    const row = await this._channelByXtreamId(playlistId, 'vod', vodId);
    const extras = parseExtras(row.extras);
    const ratings = ratingValues(extras);
    return {
      info: {
        name: extras.title || row.name,
        movie_image: toAbsoluteMediaUrl(extras.poster_url || row.logo_url) || '',
        plot: extras.plot || extras.overview || '',
        cast: extras.cast || '',
        director: extras.director || '',
        genre: extras.genre || '',
        releasedate: extras.releaseDate || extras.releasedate || (extras.year ? String(extras.year) : ''),
        duration: extras.runtime || '',
        tmdb_id: extras.tmdb_id || '',
        imdb_id: extras.imdb_id || '',
        ...ratings,
      },
      movie_data: {
        stream_id: numericXtreamId(row.xtream_id),
        name: row.name,
        added: unixSeconds(row.created_at),
        category_id: categoryId(row.category_xtream_id),
        container_extension: containerExtension(row),
        custom_sid: '',
        direct_source: '',
      },
    };
  }

  async getSeriesInfo(playlistId, seriesId) {
    const row = await this._channelByXtreamId(playlistId, 'series', seriesId);
    const extras = parseExtras(row.extras);
    const extension = containerExtension(row);
    const id = numericXtreamId(row.xtream_id);
    return {
      info: {
        name: extras.title || row.name,
        cover: toAbsoluteMediaUrl(extras.poster_url || row.logo_url) || '',
        plot: extras.plot || extras.overview || '',
        cast: extras.cast || '',
        director: extras.director || '',
        genre: extras.genre || '',
        releaseDate: extras.releaseDate || extras.releasedate || (extras.year ? String(extras.year) : ''),
        tmdb_id: extras.tmdb_id || '',
        ...ratingValues(extras),
      },
      episodes: {
        // The editor stores one row per series, not one row per episode. Expose a
        // single synthetic season/episode whose ID resolves to that series row so
        // the standard /series/... playback path still works.
        '1': [{
          id,
          episode_num: 1,
          title: row.name,
          container_extension: extension,
          info: {},
        }],
      },
    };
  }

  _epgLimit(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback;
    if (!/^\d+$/.test(String(value))) return fallback;
    return Math.min(Math.max(Number(value), 1), MAX_EPG_LIMIT);
  }

  async getEpg(playlist, streamId, requestedLimit, short) {
    const channel = await this._channelByXtreamId(playlist.id, 'live', streamId);
    if (!channel.epg_channel_id) return { epg_listings: [] };
    const limit = this._epgLimit(requestedLimit, short ? 4 : MAX_EPG_LIMIT);
    const result = await db.raw(`
      SELECT p.id, p.start_time, p.end_time, p.title, p.description, ec.channel_id
      FROM epg_programs AS p
      JOIN epg_channels AS ec ON ec.id = p.epg_channel_id
      JOIN epg_sources AS es ON es.id = ec.source_id
      WHERE ec.channel_id = ?
        AND es.user_id = ?
        AND ec.source_id = COALESCE(
          ?::uuid,
          (
            SELECT ec2.source_id
            FROM epg_channels AS ec2
            JOIN epg_sources AS es2 ON es2.id = ec2.source_id
            WHERE ec2.channel_id = ? AND es2.user_id = ?
            ORDER BY ec2.source_id
            LIMIT 1
          )
        )
        AND (p.end_time IS NULL OR p.end_time >= NOW())
      ORDER BY p.start_time, p.id
      LIMIT ?
    `, [
      channel.epg_channel_id,
      playlist.user_id,
      channel.epg_source_id || null,
      channel.epg_channel_id,
      playlist.user_id,
      limit,
    ]);

    return {
      epg_listings: result.rows.map((row) => ({
        id: row.id,
        epg_id: row.id,
        title: encodeEpgText(row.title),
        lang: '',
        start: formatDateTime(row.start_time),
        end: formatDateTime(row.end_time),
        description: encodeEpgText(row.description),
        channel_id: row.channel_id,
        start_timestamp: unixSeconds(row.start_time),
        stop_timestamp: unixSeconds(row.end_time),
      })),
    };
  }

  createXmltvStream(playlist, days) {
    return xmltvExportService.createSharedStream(playlist, days);
  }

  createM3U(playlist, username, password, output) {
    return exportService.createXtreamPlaylist(playlist, username, password, output);
  }

  async getPlaybackTarget(playlistId, streamType, streamId) {
    const row = await this._channelByXtreamId(playlistId, streamType, streamId);
    return row.stream_url;
  }
}

module.exports = new XtreamOutputService();
