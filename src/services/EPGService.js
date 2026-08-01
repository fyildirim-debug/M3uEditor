const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const config = require('../config');
const logger = require('../config/logger');
const EPGParser = require('../parsers/EPGParser');
const { encrypt, decrypt, hashToken } = require('../utils/crypto');
const { requestStream, parseRemoteUrl } = require('../utils/safeFetch');
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

  async enqueueSource(userId, url, playlistId, options = {}) {
    const source = await this.addSource(userId, url);
    const key = source.id;
    if (activeJobs.has(key)) return activeJobs.get(key);
    const job = this.parseAndStore(source.id, options)
      .then(async (result) => {
        if (playlistId) await this.autoMatch(userId, playlistId);
        return result;
      })
      .finally(() => activeJobs.delete(key));
    activeJobs.set(key, job);
    return job;
  }

  async parseAndStore(sourceId, options = {}) {
    if (activeJobs.has(`parse:${sourceId}`)) return activeJobs.get(`parse:${sourceId}`);
    const job = this._parseAndStore(sourceId, options).finally(() => activeJobs.delete(`parse:${sourceId}`));
    activeJobs.set(`parse:${sourceId}`, job);
    return job;
  }

  async _parseAndStore(sourceId, options = {}) {
    const source = await db('epg_sources').where({ id: sourceId }).first();
    if (!source) throw createAppError('NOT_FOUND', 'EPG kaynağı bulunamadı');

    const leaseCutoff = new Date(Date.now() - 15 * 60 * 1000);
    const leased = await db('epg_sources')
      .where({ id: sourceId })
      .andWhere((query) => query.whereNot({ status: 'processing' }).orWhere('processing_started_at', '<', leaseCutoff).orWhereNull('processing_started_at'))
      .update({ status: 'processing', processing_started_at: db.fn.now(), last_error: null });
    if (!leased) throw createAppError('VALIDATION_ERROR', 'Bu EPG kaynağı zaten işleniyor');

    let responseStream;
    try {
      const url = decrypt(source.url);
      if (!String(source.url).startsWith('enc:v1:')) {
        await db('epg_sources').where({ id: sourceId }).update({ url: encrypt(url), url_hash: hashToken(url) });
      }
      const response = await requestStream(url, { timeoutMs: 5 * 60_000, maxBytes: config.limits.epgBytes, accept: 'application/xml,text/xml,text/plain' });
      responseStream = response.stream;

      const result = await db.transaction(async (trx) => {
        await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`epg:${sourceId}`]);
        await trx.raw(`
          CREATE TEMPORARY TABLE epg_stage_channels (
            id uuid PRIMARY KEY,
            channel_id text NOT NULL UNIQUE,
            display_name text,
            icon_url text
          ) ON COMMIT DROP
        `);
        await trx.raw(`
          CREATE TEMPORARY TABLE epg_stage_programs (
            id uuid PRIMARY KEY,
            channel_id text NOT NULL,
            start_time timestamp NOT NULL,
            end_time timestamp,
            title text NOT NULL,
            description text
          ) ON COMMIT DROP
        `);

        const channelBatch = [];
        const programBatch = [];
        for await (const item of new EPGParser().parseStream(response.stream)) {
          if (item.type === 'channel') {
            const channel = item.data;
            channelBatch.push({
              id: uuidv4(), channel_id: String(channel.channelId).slice(0, 2000),
              display_name: channel.displayName ? String(channel.displayName).slice(0, 2000) : null,
              icon_url: channel.iconUrl ? String(channel.iconUrl).slice(0, 5000) : null,
            });
            if (channelBatch.length >= BATCH_SIZE) await this._flushStageBatch(trx, 'epg_stage_channels', channelBatch);
          } else {
            const program = item.data;
            programBatch.push({
              id: uuidv4(), channel_id: String(program.channelId).slice(0, 2000), start_time: program.startTime,
              end_time: program.endTime || null, title: String(program.title || '').slice(0, 2000),
              description: program.description ? String(program.description).slice(0, 50_000) : null,
            });
            if (programBatch.length >= BATCH_SIZE) await this._flushStageBatch(trx, 'epg_stage_programs', programBatch);
          }
        }
        await this._flushStageBatch(trx, 'epg_stage_channels', channelBatch);
        await this._flushStageBatch(trx, 'epg_stage_programs', programBatch);

        const countResult = await trx.raw(`
          SELECT
            (SELECT COUNT(*)::integer FROM epg_channels WHERE source_id = ?) AS old_channel_count,
            (SELECT COUNT(*)::integer FROM epg_programs AS p
              JOIN epg_channels AS c ON c.id = p.epg_channel_id
              WHERE c.source_id = ?) AS old_program_count,
            (SELECT COUNT(*)::integer FROM epg_stage_channels) AS new_channel_count,
            (SELECT COUNT(*)::integer FROM epg_stage_programs AS p
              JOIN epg_stage_channels AS c ON c.channel_id = p.channel_id) AS new_program_count
        `, [sourceId, sourceId]);
        const counts = countResult.rows[0];
        this._validateReplacement(counts, options.force === true);

        await trx.raw(`
          WITH updated_channels AS (
            UPDATE epg_channels AS live
            SET display_name = stage.display_name,
              icon_url = stage.icon_url
            FROM epg_stage_channels AS stage
            WHERE live.source_id = ?
              AND live.channel_id = stage.channel_id
              AND (live.display_name IS DISTINCT FROM stage.display_name
                OR live.icon_url IS DISTINCT FROM stage.icon_url)
            RETURNING live.id
          ),
          inserted_channels AS (
            INSERT INTO epg_channels (id, source_id, channel_id, display_name, icon_url)
            SELECT stage.id, ?, stage.channel_id, stage.display_name, stage.icon_url
            FROM epg_stage_channels AS stage
            WHERE NOT EXISTS (
              SELECT 1 FROM epg_channels AS live
              WHERE live.source_id = ? AND live.channel_id = stage.channel_id
            )
            RETURNING id
          )
          DELETE FROM epg_channels AS live
          WHERE live.source_id = ?
            AND NOT EXISTS (
              SELECT 1 FROM epg_stage_channels AS stage
              WHERE stage.channel_id = live.channel_id
            )
        `, [sourceId, sourceId, sourceId, sourceId]);
        await trx.raw(`
          WITH old_ranked AS (
            SELECT p.id, c.channel_id, p.start_time, p.end_time, p.title, p.description,
              row_number() OVER (
                PARTITION BY c.channel_id, p.start_time, p.end_time, p.title, p.description
                ORDER BY p.id
              ) AS occurrence
            FROM epg_programs AS p
            JOIN epg_channels AS c ON c.id = p.epg_channel_id
            WHERE c.source_id = ?
          ),
          new_ranked AS (
            SELECT p.channel_id, p.start_time, p.end_time, p.title, p.description,
              row_number() OVER (
                PARTITION BY p.channel_id, p.start_time, p.end_time, p.title, p.description
                ORDER BY p.id
              ) AS occurrence
            FROM epg_stage_programs AS p
            JOIN epg_stage_channels AS c ON c.channel_id = p.channel_id
          )
          DELETE FROM epg_programs AS live
          USING old_ranked AS old
          WHERE live.id = old.id
            AND NOT EXISTS (
              SELECT 1 FROM new_ranked AS fresh
              WHERE fresh.channel_id = old.channel_id
                AND fresh.start_time = old.start_time
                AND fresh.end_time IS NOT DISTINCT FROM old.end_time
                AND fresh.title = old.title
                AND fresh.description IS NOT DISTINCT FROM old.description
                AND fresh.occurrence = old.occurrence
            )
        `, [sourceId]);
        await trx.raw(`
          WITH live_ranked AS (
            SELECT c.channel_id, p.start_time, p.end_time, p.title, p.description,
              row_number() OVER (
                PARTITION BY c.channel_id, p.start_time, p.end_time, p.title, p.description
                ORDER BY p.id
              ) AS occurrence
            FROM epg_programs AS p
            JOIN epg_channels AS c ON c.id = p.epg_channel_id
            WHERE c.source_id = ?
          ),
          new_ranked AS (
            SELECT p.*,
              row_number() OVER (
                PARTITION BY p.channel_id, p.start_time, p.end_time, p.title, p.description
                ORDER BY p.id
              ) AS occurrence
            FROM epg_stage_programs AS p
            JOIN epg_stage_channels AS staged_channel ON staged_channel.channel_id = p.channel_id
          )
          INSERT INTO epg_programs (id, epg_channel_id, start_time, end_time, title, description)
          SELECT fresh.id, c.id, fresh.start_time, fresh.end_time, fresh.title, fresh.description
          FROM new_ranked AS fresh
          JOIN epg_channels AS c ON c.source_id = ? AND c.channel_id = fresh.channel_id
          WHERE NOT EXISTS (
            SELECT 1 FROM live_ranked AS live
            WHERE live.channel_id = fresh.channel_id
              AND live.start_time = fresh.start_time
              AND live.end_time IS NOT DISTINCT FROM fresh.end_time
              AND live.title = fresh.title
              AND live.description IS NOT DISTINCT FROM fresh.description
              AND live.occurrence = fresh.occurrence
          )
        `, [sourceId, sourceId]);
        await trx('epg_sources').where({ id: sourceId }).update({
          status: 'active', last_fetched_at: trx.fn.now(), processing_started_at: null, last_error: null,
        });
        return { channelCount: Number(counts.new_channel_count), programCount: Number(counts.new_program_count) };
      });
      return result;
    } catch (error) {
      if (responseStream && !responseStream.destroyed) responseStream.destroy();
      await db('epg_sources').where({ id: sourceId }).update({
        status: 'error', processing_started_at: null, last_error: String(error.message || error).slice(0, 1000),
      });
      logger.warn({ err: error, sourceId }, 'EPG source processing failed');
      if (error.statusCode) throw error;
      throw createAppError('EPG_FETCH_FAILED', `EPG işlenemedi: ${error.message}`);
    }
  }

  async _flushStageBatch(connection, table, rows) {
    if (!rows.length) return;
    const batch = rows.splice(0, rows.length);
    const query = connection(table).insert(batch);
    if (table === 'epg_stage_channels') await query.onConflict('channel_id').ignore();
    else await query;
  }

  _validateReplacement(counts, force = false) {
    if (force) return;
    const oldChannels = Number(counts.old_channel_count);
    const oldPrograms = Number(counts.old_program_count);
    const newChannels = Number(counts.new_channel_count);
    const newPrograms = Number(counts.new_program_count);
    const reasons = [];
    if (newChannels === 0 || newPrograms === 0) reasons.push('yeni rehber boş');
    if (oldChannels > 0 && newChannels * 2 < oldChannels) reasons.push(`kanal sayısı ${oldChannels} -> ${newChannels}`);
    if (oldPrograms > 0 && newPrograms * 2 < oldPrograms) reasons.push(`program sayısı ${oldPrograms} -> ${newPrograms}`);
    if (reasons.length) {
      throw new Error(`EPG güvenlik kontrolü reddetti: ${reasons.join(', ')}. Bilinçli değiştirme için force=true kullanın`);
    }
  }

  _normalizeName(name) {
    return String(name || '').toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }

  async autoMatch(userId, playlistId) {
    const result = await db.raw(`
      WITH playlist_channels AS MATERIALIZED (
        SELECT c.id,
          btrim(regexp_replace(lower(translate(COALESCE(c.name, ''), 'IİĞÜŞÖÇ', 'ıiğüşöç')), '[^[:alnum:]]+', ' ', 'g')) AS normalized
        FROM channels AS c
        JOIN playlists AS p ON p.id = c.playlist_id
        WHERE p.id = ? AND p.user_id = ?
      ),
      user_epg AS MATERIALIZED (
        SELECT e.channel_id, e.source_id,
          btrim(regexp_replace(lower(translate(COALESCE(e.display_name, ''), 'IİĞÜŞÖÇ', 'ıiğüşöç')), '[^[:alnum:]]+', ' ', 'g')) AS normalized
        FROM epg_channels AS e
        JOIN epg_sources AS s ON s.id = e.source_id
        WHERE s.user_id = ?
      ),
      channel_tokens AS (
        SELECT DISTINCT c.id, token
        FROM playlist_channels AS c
        CROSS JOIN LATERAL regexp_split_to_table(c.normalized, '\\s+') AS token
        WHERE length(token) > 1
      ),
      epg_tokens AS (
        SELECT DISTINCT e.channel_id, e.source_id, token
        FROM user_epg AS e
        CROSS JOIN LATERAL regexp_split_to_table(e.normalized, '\\s+') AS token
        WHERE length(token) > 1
      ),
      candidates AS (
        SELECT c.id AS playlist_channel_id, c.normalized AS channel_name,
          e.channel_id AS epg_channel_id, e.source_id AS epg_source_id, e.normalized AS epg_name
        FROM playlist_channels AS c
        JOIN user_epg AS e ON e.normalized = c.normalized
        WHERE c.normalized <> ''
        UNION
        SELECT c.id, c.normalized, e.channel_id, e.source_id, e.normalized
        FROM channel_tokens AS ct
        JOIN epg_tokens AS et ON et.token = ct.token
        JOIN playlist_channels AS c ON c.id = ct.id
        JOIN user_epg AS e ON e.channel_id = et.channel_id AND e.source_id = et.source_id
      ),
      scored AS (
        SELECT *, CASE
          WHEN channel_name = epg_name THEN 1.0
          WHEN position(epg_name IN channel_name) > 0 OR position(channel_name IN epg_name) > 0 THEN 0.7
          ELSE 0.5
        END AS confidence
        FROM candidates
      ),
      ranked AS (
        SELECT *, row_number() OVER (
          PARTITION BY playlist_channel_id
          ORDER BY confidence DESC, similarity(channel_name, epg_name) DESC, epg_source_id, epg_channel_id
        ) AS match_rank
        FROM scored
      ),
      best AS (
        SELECT * FROM ranked WHERE match_rank = 1 AND confidence >= 0.5
      ),
      updated AS (
        UPDATE channels AS c
        SET epg_channel_id = best.epg_channel_id,
          epg_source_id = best.epg_source_id,
          updated_at = NOW()
        FROM best
        WHERE c.id = best.playlist_channel_id
        RETURNING c.id AS channel_id, best.epg_channel_id, best.epg_source_id, best.confidence
      )
      SELECT (SELECT COUNT(*)::integer FROM playlist_channels) AS total,
        COALESCE((SELECT json_agg(json_build_object(
          'channelId', channel_id,
          'epgChannelId', epg_channel_id,
          'epgSourceId', epg_source_id,
          'confidence', confidence
        ) ORDER BY confidence DESC) FROM updated), '[]'::json) AS matches
    `, [playlistId, userId, userId]);
    const row = result.rows[0];
    const matches = typeof row.matches === 'string' ? JSON.parse(row.matches) : row.matches;
    return { matched: matches.length, total: Number(row.total), matches };
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

  async refreshSource(userId, sourceId, options = {}) {
    const source = await db('epg_sources').where({ id: sourceId, user_id: userId }).first();
    if (!source) throw createAppError('NOT_FOUND', 'EPG kaynağı bulunamadı');
    return this.parseAndStore(sourceId, options);
  }

  async getGuide(userId, playlistId, date, timezoneOffset, page = 1, limit = 100) {
    const playlist = await db('playlists').where({ id: playlistId, user_id: userId }).first();
    if (!playlist) throw createAppError('NOT_FOUND', 'Oynatma listesi bulunamadı');
    const { dateStr, start, end } = buildDateRange(date, timezoneOffset);
    const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 100, 1), 500);
    const safePage = Math.max(Number.parseInt(page, 10) || 1, 1);

    // Buyuk playlistlerde (50k+ kanal) tum kanallari tek yanitta donmek
    // tarayiciyi kilitler; kanallar sayfali yuklenir.
    const [channels, totalRow] = await Promise.all([
      db('channels').where({ playlist_id: playlistId }).orderBy('sort_order')
        .select('id', 'name', 'logo_url', 'epg_channel_id', 'epg_source_id')
        .limit(safeLimit).offset((safePage - 1) * safeLimit),
      db('channels').where({ playlist_id: playlistId }).count('id as count').first(),
    ]);
    const total = Number(totalRow?.count) || 0;
    if (!channels.length) return { channels: [], date: dateStr, total, page: safePage, limit: safeLimit };

    const ids = [...new Set(channels.map((channel) => channel.epg_channel_id).filter(Boolean))];
    const epgRows = ids.length ? await db('epg_channels')
      .join('epg_sources', 'epg_channels.source_id', 'epg_sources.id')
      .where('epg_sources.user_id', userId)
      .whereIn('epg_channels.channel_id', ids)
      .select('epg_channels.id', 'epg_channels.channel_id', 'epg_channels.source_id') : [];
    const exactMap = new Map(epgRows.map((row) => [`${row.source_id}:${row.channel_id}`, row.id]));
    const fallbackMap = new Map(epgRows.map((row) => [row.channel_id, row.id]));
    const epgUuids = [...new Set(epgRows.map((row) => row.id))];
    // Grid yalnizca baslik/zaman gosterir; description (50 KB'a kadar) tasimak
    // yaniti cok buyutur. Detay modalinda GET /epg/programs/:id ile cekilir.
    const programs = epgUuids.length ? await db('epg_programs').whereIn('epg_channel_id', epgUuids)
      .where('start_time', '<', end)
      .andWhere((query) => query.whereNull('end_time').orWhere('end_time', '>=', start))
      .orderBy('start_time')
      .select('id', 'epg_channel_id', 'start_time', 'end_time', 'title') : [];
    const grouped = new Map();
    for (const program of programs) {
      if (!grouped.has(program.epg_channel_id)) grouped.set(program.epg_channel_id, []);
      grouped.get(program.epg_channel_id).push(program);
    }
    return {
      date: dateStr,
      total,
      page: safePage,
      limit: safeLimit,
      channels: channels.map((channel) => {
        const epgUuid = exactMap.get(`${channel.epg_source_id}:${channel.epg_channel_id}`) || fallbackMap.get(channel.epg_channel_id);
        return { ...channel, programs: grouped.get(epgUuid) || [] };
      }),
    };
  }

  async getProgram(userId, programId) {
    const program = await db('epg_programs')
      .join('epg_channels', 'epg_programs.epg_channel_id', 'epg_channels.id')
      .join('epg_sources', 'epg_channels.source_id', 'epg_sources.id')
      .where('epg_programs.id', programId)
      .where('epg_sources.user_id', userId)
      .first('epg_programs.id', 'epg_programs.epg_channel_id', 'epg_programs.start_time', 'epg_programs.end_time', 'epg_programs.title', 'epg_programs.description');
    if (!program) throw createAppError('NOT_FOUND', 'Program bulunamadı');
    return program;
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
