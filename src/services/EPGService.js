const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const config = require('../config');
const logger = require('../config/logger');
const EPGParser = require('../parsers/EPGParser');
const { encrypt, decrypt, hashToken } = require('../utils/crypto');
const { safeFetchText, parseRemoteUrl } = require('../utils/safeFetch');
const { buildDateRange } = require('../utils/validation');
const { createAppError } = require('../utils/AppError');

const BATCH_SIZE = 500;
const activeJobs = new Map();

class EPGService {
  async addSource(userId, url) {
    if (typeof url !== 'string' || !url.trim() || url.length > 5000) {
      throw createAppError('VALIDATION_ERROR', 'Geçerli bir EPG adresi gerekli');
    }
    const normalized = parseRemoteUrl(url.trim()).toString();
    const urlHash = hashToken(normalized);
    let source = await db('epg_sources').where({ user_id: userId, url_hash: urlHash }).first();
    if (!source) {
      // Compatibility with sources created before URL hashing.
      const legacySources = await db('epg_sources').where({ user_id: userId }).whereNull('url_hash');
      source = legacySources.find((candidate) => decrypt(candidate.url) === normalized);
      if (source) await db('epg_sources').where({ id: source.id }).update({ url: encrypt(normalized), url_hash: urlHash });
    }
    if (source) return this._publicSource({ ...source, url: encrypt(normalized), url_hash: urlHash });

    [source] = await db('epg_sources').insert({
      id: uuidv4(), user_id: userId, url: encrypt(normalized), url_hash: urlHash, status: 'pending',
    }).returning('*');
    return this._publicSource(source);
  }

  async listSources(userId) {
    const sources = await db('epg_sources')
      .where({ user_id: userId })
      .select('id', 'user_id', 'url', 'status', 'last_fetched_at', 'last_error', 'created_at')
      .orderBy('created_at', 'desc');
    return sources.map((source) => this._publicSource(source));
  }

  _publicSource(source) {
    let displayUrl = 'Gizli EPG kaynağı';
    try {
      const parsed = new URL(decrypt(source.url));
      displayUrl = `${parsed.origin}${parsed.pathname}`;
    } catch {}
    const { url, url_hash, ...safe } = source;
    return { ...safe, url: displayUrl };
  }

  async enqueueSource(userId, url, playlistId) {
    const source = await this.addSource(userId, url);
    const key = source.id;
    if (activeJobs.has(key)) return activeJobs.get(key);
    const job = this.parseAndStore(source.id)
      .then(async (result) => {
        if (playlistId) await this.autoMatch(userId, playlistId);
        return result;
      })
      .finally(() => activeJobs.delete(key));
    activeJobs.set(key, job);
    return job;
  }

  async parseAndStore(sourceId) {
    if (activeJobs.has(`parse:${sourceId}`)) return activeJobs.get(`parse:${sourceId}`);
    const job = this._parseAndStore(sourceId).finally(() => activeJobs.delete(`parse:${sourceId}`));
    activeJobs.set(`parse:${sourceId}`, job);
    return job;
  }

  async _parseAndStore(sourceId) {
    const source = await db('epg_sources').where({ id: sourceId }).first();
    if (!source) throw createAppError('NOT_FOUND', 'EPG kaynağı bulunamadı');

    const leaseCutoff = new Date(Date.now() - 15 * 60 * 1000);
    const leased = await db('epg_sources')
      .where({ id: sourceId })
      .andWhere((query) => query.whereNot({ status: 'processing' }).orWhere('processing_started_at', '<', leaseCutoff).orWhereNull('processing_started_at'))
      .update({ status: 'processing', processing_started_at: db.fn.now(), last_error: null });
    if (!leased) throw createAppError('VALIDATION_ERROR', 'Bu EPG kaynağı zaten işleniyor');

    try {
      const url = decrypt(source.url);
      if (!String(source.url).startsWith('enc:v1:')) {
        await db('epg_sources').where({ id: sourceId }).update({ url: encrypt(url), url_hash: hashToken(url) });
      }
      const response = await safeFetchText(url, { timeoutMs: 5 * 60_000, maxBytes: config.limits.epgBytes, accept: 'application/xml,text/xml,text/plain' });
      const parsed = new EPGParser().parse(response.text);

      const result = await db.transaction(async (trx) => {
        await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`epg:${sourceId}`]);
        await trx('epg_channels').where({ source_id: sourceId }).del();

        const channelIds = new Map();
        const channelRows = [];
        for (const channel of parsed.channels) {
          if (!channel.channelId || channelIds.has(channel.channelId)) continue;
          const id = uuidv4();
          channelIds.set(channel.channelId, id);
          channelRows.push({
            id, source_id: sourceId, channel_id: String(channel.channelId).slice(0, 2000),
            display_name: channel.displayName ? String(channel.displayName).slice(0, 2000) : null,
            icon_url: channel.iconUrl ? String(channel.iconUrl).slice(0, 5000) : null,
          });
        }
        await this._insertBatches(trx, 'epg_channels', channelRows);

        const programRows = [];
        for (const program of parsed.programs) {
          const epgChannelId = channelIds.get(program.channelId);
          if (!epgChannelId) continue;
          programRows.push({
            id: uuidv4(), epg_channel_id: epgChannelId, start_time: program.startTime,
            end_time: program.endTime || null, title: String(program.title || '').slice(0, 2000),
            description: program.description ? String(program.description).slice(0, 50_000) : null,
          });
        }
        await this._insertBatches(trx, 'epg_programs', programRows);
        await trx('epg_sources').where({ id: sourceId }).update({
          status: 'active', last_fetched_at: trx.fn.now(), processing_started_at: null, last_error: null,
        });
        return { channelCount: channelRows.length, programCount: programRows.length };
      });
      return result;
    } catch (error) {
      await db('epg_sources').where({ id: sourceId }).update({
        status: 'error', processing_started_at: null, last_error: String(error.message || error).slice(0, 1000),
      });
      logger.warn({ err: error, sourceId }, 'EPG source processing failed');
      if (error.statusCode) throw error;
      throw createAppError('EPG_FETCH_FAILED', `EPG işlenemedi: ${error.message}`);
    }
  }

  async _insertBatches(connection, table, rows) {
    for (let index = 0; index < rows.length; index += BATCH_SIZE) {
      await connection(table).insert(rows.slice(index, index + BATCH_SIZE));
    }
  }

  _normalizeName(name) {
    return String(name || '').toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }

  async autoMatch(userId, playlistId) {
    const channels = await db('channels')
      .join('playlists', 'channels.playlist_id', 'playlists.id')
      .where({ 'playlists.id': playlistId, 'playlists.user_id': userId })
      .select('channels.id', 'channels.name');
    if (!channels.length) return { matched: 0, total: 0, matches: [] };

    const epgChannels = await db('epg_channels')
      .join('epg_sources', 'epg_channels.source_id', 'epg_sources.id')
      .where({ 'epg_sources.user_id': userId })
      .select('epg_channels.channel_id', 'epg_channels.source_id', 'epg_channels.display_name');
    if (!epgChannels.length) return { matched: 0, total: channels.length, matches: [] };

    const exact = new Map();
    const tokenIndex = new Map();
    for (const epgChannel of epgChannels) {
      const normalized = this._normalizeName(epgChannel.display_name);
      epgChannel.normalized = normalized;
      if (normalized && !exact.has(normalized)) exact.set(normalized, epgChannel);
      for (const token of normalized.split(' ').filter((part) => part.length > 1)) {
        if (!tokenIndex.has(token)) tokenIndex.set(token, new Set());
        tokenIndex.get(token).add(epgChannel);
      }
    }

    const matches = [];
    for (const channel of channels) {
      const normalized = this._normalizeName(channel.name);
      if (!normalized) continue;
      let best = exact.get(normalized);
      let confidence = best ? 1 : 0;
      if (!best) {
        const candidates = new Set();
        for (const token of normalized.split(' ')) for (const candidate of tokenIndex.get(token) || []) candidates.add(candidate);
        for (const candidate of candidates) {
          const score = this._calculateSimilarity(normalized, candidate.normalized);
          if (score > confidence) { best = candidate; confidence = score; }
        }
      }
      if (best && confidence >= 0.5) {
        matches.push({ channelId: channel.id, epgChannelId: best.channel_id, epgSourceId: best.source_id, confidence });
      }
    }
    matches.sort((a, b) => b.confidence - a.confidence);
    await db.transaction(async (trx) => {
      for (const match of matches) {
        await trx('channels').where({ id: match.channelId }).update({
          epg_channel_id: match.epgChannelId, epg_source_id: match.epgSourceId, updated_at: trx.fn.now(),
        });
      }
    });
    return { matched: matches.length, total: channels.length, matches };
  }

  async getPreview(userId, channelId, date, timezoneOffset) {
    const channel = await db('channels')
      .join('playlists', 'channels.playlist_id', 'playlists.id')
      .where({ 'channels.id': channelId, 'playlists.user_id': userId })
      .select('channels.*')
      .first();
    if (!channel) throw createAppError('NOT_FOUND', 'Kanal bulunamadı');
    if (!channel.epg_channel_id) return [];

    const epgQuery = db('epg_channels')
      .join('epg_sources', 'epg_channels.source_id', 'epg_sources.id')
      .where({ 'epg_channels.channel_id': channel.epg_channel_id, 'epg_sources.user_id': userId });
    if (channel.epg_source_id) epgQuery.andWhere('epg_channels.source_id', channel.epg_source_id);
    const epgChannel = await epgQuery.select('epg_channels.id').first();
    if (!epgChannel) return [];

    const { start, end } = buildDateRange(date, timezoneOffset);
    return db('epg_programs').where({ epg_channel_id: epgChannel.id })
      .where('start_time', '<', end)
      .andWhere((query) => query.whereNull('end_time').orWhere('end_time', '>=', start))
      .orderBy('start_time', 'asc');
  }

  async deleteSource(userId, sourceId) {
    const deleted = await db('epg_sources').where({ id: sourceId, user_id: userId }).del();
    if (!deleted) throw createAppError('NOT_FOUND', 'EPG kaynağı bulunamadı');
  }

  async refreshSource(userId, sourceId) {
    const source = await db('epg_sources').where({ id: sourceId, user_id: userId }).first();
    if (!source) throw createAppError('NOT_FOUND', 'EPG kaynağı bulunamadı');
    return this.parseAndStore(sourceId);
  }

  async getGuide(userId, playlistId, date, timezoneOffset) {
    const playlist = await db('playlists').where({ id: playlistId, user_id: userId }).first();
    if (!playlist) throw createAppError('NOT_FOUND', 'Oynatma listesi bulunamadı');
    const { dateStr, start, end } = buildDateRange(date, timezoneOffset);
    const channels = await db('channels').where({ playlist_id: playlistId }).orderBy('sort_order')
      .select('id', 'name', 'logo_url', 'epg_channel_id', 'epg_source_id');
    if (!channels.length) return { channels: [], date: dateStr };

    const ids = [...new Set(channels.map((channel) => channel.epg_channel_id).filter(Boolean))];
    const epgRows = ids.length ? await db('epg_channels')
      .join('epg_sources', 'epg_channels.source_id', 'epg_sources.id')
      .where('epg_sources.user_id', userId)
      .whereIn('epg_channels.channel_id', ids)
      .select('epg_channels.id', 'epg_channels.channel_id', 'epg_channels.source_id') : [];
    const exactMap = new Map(epgRows.map((row) => [`${row.source_id}:${row.channel_id}`, row.id]));
    const fallbackMap = new Map(epgRows.map((row) => [row.channel_id, row.id]));
    const epgUuids = [...new Set(epgRows.map((row) => row.id))];
    const programs = epgUuids.length ? await db('epg_programs').whereIn('epg_channel_id', epgUuids)
      .where('start_time', '<', end)
      .andWhere((query) => query.whereNull('end_time').orWhere('end_time', '>=', start))
      .orderBy('start_time') : [];
    const grouped = new Map();
    for (const program of programs) {
      if (!grouped.has(program.epg_channel_id)) grouped.set(program.epg_channel_id, []);
      grouped.get(program.epg_channel_id).push(program);
    }
    return {
      date: dateStr,
      channels: channels.map((channel) => {
        const epgUuid = exactMap.get(`${channel.epg_source_id}:${channel.epg_channel_id}`) || fallbackMap.get(channel.epg_channel_id);
        return { ...channel, programs: grouped.get(epgUuid) || [] };
      }),
    };
  }

  async searchEpgChannels(userId, query, limit = 15) {
    if (typeof query !== 'string' || query.trim().length < 2) return [];
    const cappedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 15, 1), 50);
    return db('epg_channels')
      .join('epg_sources', 'epg_channels.source_id', 'epg_sources.id')
      .where('epg_sources.user_id', userId)
      .andWhere((builder) => builder.where('epg_channels.display_name', 'ilike', `%${query.trim()}%`).orWhere('epg_channels.channel_id', 'ilike', `%${query.trim()}%`))
      .select('epg_channels.channel_id', 'epg_channels.source_id', 'epg_channels.display_name', 'epg_channels.icon_url')
      .limit(cappedLimit);
  }

  _calculateSimilarity(a, b) {
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return 0.7;
    const wordsB = new Set(b.split(/\s+/));
    return a.split(/\s+/).some((word) => word.length > 1 && wordsB.has(word)) ? 0.5 : 0;
  }
}

module.exports = EPGService;
