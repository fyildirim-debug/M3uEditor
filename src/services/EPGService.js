const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const EPGParser = require('../parsers/EPGParser');
const { createAppError } = require('../utils/AppError');

const FETCH_TIMEOUT = 120000; // 120 seconds for EPG fetch (EPG files can be very large)

class EPGService {
  /**
   * Add a new EPG source for a user.
   * Validates URL format and inserts with 'pending' status.
   * @param {string} userId
   * @param {string} url - EPG source URL
   * @returns {Promise<object>} Created EPG source record
   */
  async addSource(userId, url) {
    if (!url || typeof url !== 'string') {
      throw createAppError('VALIDATION_ERROR', 'EPG kaynağı URL\'si gereklidir');
    }

    try {
      new URL(url);
    } catch {
      throw createAppError('VALIDATION_ERROR', 'Geçersiz URL formatı');
    }

    const [source] = await db('epg_sources')
      .insert({
        id: uuidv4(),
        user_id: userId,
        url,
        status: 'pending',
      })
      .returning('*');

    return source;
  }

  /**
   * Fetch EPG XML from source URL, parse it, and store channels/programs.
   * On error: updates source status to 'error' but keeps existing data (req 5.5).
   * @param {string} sourceId
   * @returns {Promise<{ channelCount: number, programCount: number }>}
   */
  async parseAndStore(sourceId) {
    const source = await db('epg_sources').where({ id: sourceId }).first();
    if (!source) {
      throw createAppError('NOT_FOUND', 'EPG kaynağı bulunamadı');
    }

    let xmlContent;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const response = await fetch(source.url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      xmlContent = await response.text();
    } catch (err) {
      // Update status to 'error' but keep existing data (requirement 5.5)
      await db('epg_sources')
        .where({ id: sourceId })
        .update({ status: 'error' });

      throw createAppError('EPG_FETCH_FAILED', `EPG kaynağı alınamadı: ${err.message}`);
    }

    let parsed;
    try {
      const parser = new EPGParser();
      parsed = parser.parse(xmlContent);
    } catch (err) {
      await db('epg_sources')
        .where({ id: sourceId })
        .update({ status: 'error' });

      throw createAppError('EPG_FETCH_FAILED', `EPG verisi ayrıştırılamadı: ${err.message}`);
    }

    // Delete existing channels and programs for this source, then insert new ones
    await db('epg_channels').where({ source_id: sourceId }).del();

    let channelCount = 0;
    let programCount = 0;

    // Build a map of channelId → DB UUID for program insertion
    const channelIdMap = {};

    for (const ch of parsed.channels) {
      const channelUuid = uuidv4();
      await db('epg_channels').insert({
        id: channelUuid,
        source_id: sourceId,
        channel_id: ch.channelId,
        display_name: ch.displayName || null,
        icon_url: ch.iconUrl || null,
      });
      channelIdMap[ch.channelId] = channelUuid;
      channelCount++;
    }

    for (const prog of parsed.programs) {
      const epgChannelUuid = channelIdMap[prog.channelId];
      if (!epgChannelUuid) continue; // skip programs for unknown channels

      await db('epg_programs').insert({
        id: uuidv4(),
        epg_channel_id: epgChannelUuid,
        start_time: prog.startTime,
        end_time: prog.endTime,
        title: prog.title || '',
        description: prog.description || null,
      });
      programCount++;
    }

    // Update source status to 'active' and last_fetched_at
    await db('epg_sources')
      .where({ id: sourceId })
      .update({ status: 'active', last_fetched_at: new Date() });

    return { channelCount, programCount };
  }

  /**
   * Auto-match playlist channels with EPG channels based on name similarity.
   * Applies matches with confidence >= 0.5 by updating channels.epg_channel_id.
   * Matching strategy (from design):
   *   - Exact match (case-insensitive): confidence = 1.0
   *   - One name contains the other: confidence = 0.7
   *   - Partial word overlap: confidence = 0.5
   *   - No match: skip
   * Returns matches sorted by confidence descending (requirement 5.6).
   * @param {string} userId
   * @param {string} playlistId
   * @returns {Promise<{ matched: number, total: number, matches: Array<{ channelId: string, epgChannelId: string, confidence: number }> }>}
   */
  async autoMatch(userId, playlistId) {
    // Get all channels in the playlist
    const channels = await db('channels')
      .join('playlists', 'channels.playlist_id', 'playlists.id')
      .where({ 'playlists.id': playlistId, 'playlists.user_id': userId })
      .select('channels.id', 'channels.name');

    if (channels.length === 0) return { matched: 0, total: 0, matches: [] };

    // Get all EPG channels from user's sources
    const epgChannels = await db('epg_channels')
      .join('epg_sources', 'epg_channels.source_id', 'epg_sources.id')
      .where({ 'epg_sources.user_id': userId })
      .select('epg_channels.id', 'epg_channels.channel_id', 'epg_channels.display_name');

    if (epgChannels.length === 0) return { matched: 0, total: channels.length, matches: [] };

    const matches = [];

    for (const channel of channels) {
      let bestMatch = null;
      let bestConfidence = 0;

      const channelNameLower = (channel.name || '').toLowerCase().trim();
      if (!channelNameLower) continue;

      for (const epgChannel of epgChannels) {
        const epgNameLower = (epgChannel.display_name || '').toLowerCase().trim();
        if (!epgNameLower) continue;

        const confidence = this._calculateSimilarity(channelNameLower, epgNameLower);

        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestMatch = epgChannel;
        }
      }

      if (bestMatch && bestConfidence > 0) {
        matches.push({
          channelId: channel.id,
          epgChannelId: bestMatch.channel_id,
          confidence: bestConfidence,
        });
      }
    }

    // Sort by confidence descending (exact matches first)
    matches.sort((a, b) => b.confidence - a.confidence);

    // Apply matches with confidence >= 0.5 by updating channels.epg_channel_id
    const applicableMatches = matches.filter(m => m.confidence >= 0.5);

    for (const match of applicableMatches) {
      await db('channels')
        .where({ id: match.channelId })
        .update({ epg_channel_id: match.epgChannelId, updated_at: new Date() });
    }

    return {
      matched: applicableMatches.length,
      total: channels.length,
      matches,
    };
  }

  /**
   * Get EPG preview (program schedule) for a channel.
   * @param {string} channelId - The channel's UUID
   * @param {string} [date] - Optional date string (YYYY-MM-DD). Defaults to today.
   * @returns {Promise<Array<object>>} Programs ordered by start_time
   */
  async getPreview(channelId, date) {
    // Get the channel's epg_channel_id
    const channel = await db('channels').where({ id: channelId }).first();
    if (!channel) {
      throw createAppError('NOT_FOUND', 'Kanal bulunamadı');
    }

    if (!channel.epg_channel_id) {
      return [];
    }

    // Find the EPG channel record by channel_id string
    const epgChannel = await db('epg_channels')
      .where({ channel_id: channel.epg_channel_id })
      .first();

    if (!epgChannel) {
      return [];
    }

    // Build date range filter
    let startOfDay, endOfDay;
    if (date) {
      startOfDay = new Date(`${date}T00:00:00.000Z`);
      endOfDay = new Date(`${date}T23:59:59.999Z`);
    } else {
      const today = new Date();
      const yyyy = today.getUTCFullYear();
      const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(today.getUTCDate()).padStart(2, '0');
      startOfDay = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
      endOfDay = new Date(`${yyyy}-${mm}-${dd}T23:59:59.999Z`);
    }

    const programs = await db('epg_programs')
      .where({ epg_channel_id: epgChannel.id })
      .where('start_time', '>=', startOfDay)
      .where('start_time', '<=', endOfDay)
      .orderBy('start_time', 'asc');

    return programs;
  }

  /**
   * Delete an EPG source belonging to the user.
   * Cascade will handle removing associated epg_channels and epg_programs.
   * @param {string} userId
   * @param {string} sourceId
   * @returns {Promise<void>}
   */
  async deleteSource(userId, sourceId) {
    const source = await db('epg_sources')
      .where({ id: sourceId, user_id: userId })
      .first();

    if (!source) {
      throw createAppError('NOT_FOUND', 'EPG kaynağı bulunamadı');
    }

    await db('epg_sources').where({ id: sourceId }).del();
  }

  /**
   * Refresh an EPG source by re-fetching and re-parsing its XML data.
   * @param {string} userId
   * @param {string} sourceId
   * @returns {Promise<{ channelCount: number, programCount: number }>}
   */
  async refreshSource(userId, sourceId) {
    const source = await db('epg_sources')
      .where({ id: sourceId, user_id: userId })
      .first();

    if (!source) {
      throw createAppError('NOT_FOUND', 'EPG kaynağı bulunamadı');
    }

    return this.parseAndStore(sourceId);
  }

  /**
   * Get the full EPG guide for a playlist on a given date.
   * Returns channels with their associated programs in a single efficient query flow.
   * @param {string} userId
   * @param {string} playlistId
   * @param {string} [date] - Date string (YYYY-MM-DD). Defaults to today.
   * @returns {Promise<{ channels: Array<{ id: string, name: string, logo_url: string, epg_channel_id: string, programs: Array }>, date: string }>}
   */
  async getGuide(userId, playlistId, date) {
    // Verify playlist belongs to user
    const playlist = await db('playlists')
      .where({ id: playlistId, user_id: userId })
      .first();

    if (!playlist) {
      throw createAppError('NOT_FOUND', 'Playlist bulunamadı');
    }

    // Build date range
    let dateStr;
    if (date) {
      dateStr = date;
    } else {
      const today = new Date();
      const yyyy = today.getUTCFullYear();
      const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(today.getUTCDate()).padStart(2, '0');
      dateStr = `${yyyy}-${mm}-${dd}`;
    }
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    // Step 1: Get ALL channels for the playlist (not just matched ones)
    const channels = await db('channels')
      .where({ playlist_id: playlistId })
      .orderBy('position', 'asc')
      .select('id', 'name', 'logo_url', 'epg_channel_id');

    if (channels.length === 0) {
      return { channels: [], date: dateStr };
    }

    // Filter channels that have EPG mapping for program fetching
    const mappedChannels = channels.filter(ch => ch.epg_channel_id);

    // Step 2: Collect all unique epg_channel_id strings and find their UUID records
    const epgChannelIds = [...new Set(mappedChannels.map(ch => ch.epg_channel_id))];

    const epgChannelRecords = await db('epg_channels')
      .whereIn('channel_id', epgChannelIds)
      .select('id', 'channel_id');

    // Map from channel_id string -> epg_channels UUID
    const epgChannelIdToUuid = {};
    for (const rec of epgChannelRecords) {
      epgChannelIdToUuid[rec.channel_id] = rec.id;
    }

    // Step 3: Get all epg_channel UUIDs that we need programs for
    const epgChannelUuids = Object.values(epgChannelIdToUuid);

    let programs = [];
    if (epgChannelUuids.length > 0) {
      programs = await db('epg_programs')
        .whereIn('epg_channel_id', epgChannelUuids)
        .where('start_time', '>=', startOfDay)
        .where('start_time', '<=', endOfDay)
        .orderBy('start_time', 'asc');
    }

    // Step 4: Group programs by epg_channel UUID
    const programsByEpgUuid = {};
    for (const prog of programs) {
      if (!programsByEpgUuid[prog.epg_channel_id]) {
        programsByEpgUuid[prog.epg_channel_id] = [];
      }
      programsByEpgUuid[prog.epg_channel_id].push(prog);
    }

    // Step 5: Map programs to channels
    const result = channels.map(ch => {
      const epgUuid = epgChannelIdToUuid[ch.epg_channel_id];
      return {
        id: ch.id,
        name: ch.name,
        logo_url: ch.logo_url,
        epg_channel_id: ch.epg_channel_id,
        programs: epgUuid ? (programsByEpgUuid[epgUuid] || []) : [],
      };
    });

    return { channels: result, date: dateStr };
  }

  /**
   * Search EPG channels by name for autocomplete.
   * Returns matching EPG channels with icon_url for display.
   * @param {string} userId
   * @param {string} query - Search query string
   * @param {number} [limit=15] - Max results
   * @returns {Promise<Array<{ channel_id: string, display_name: string, icon_url: string }>>}
   */
  async searchEpgChannels(userId, query, limit = 15) {
    if (!query || query.trim().length < 2) return [];

    const q = query.trim();
    const results = await db('epg_channels')
      .join('epg_sources', 'epg_channels.source_id', 'epg_sources.id')
      .where('epg_sources.user_id', userId)
      .where(function () {
        this.where('epg_channels.display_name', 'ilike', `%${q}%`)
          .orWhere('epg_channels.channel_id', 'ilike', `%${q}%`);
      })
      .select('epg_channels.channel_id', 'epg_channels.display_name', 'epg_channels.icon_url')
      .limit(limit);

    return results;
  }

  /**
   * Calculate string similarity between two lowercased names.
   * @param {string} a - First name (lowercased)
   * @param {string} b - Second name (lowercased)
   * @returns {number} Confidence score: 1.0, 0.7, 0.5, or 0
   * @private
   */
  _calculateSimilarity(a, b) {
    // Exact match (case-insensitive, already lowered)
    if (a === b) return 1.0;

    // One contains the other
    if (a.includes(b) || b.includes(a)) return 0.7;

    // Partial word overlap
    const wordsA = new Set(a.split(/\s+/).filter(Boolean));
    const wordsB = new Set(b.split(/\s+/).filter(Boolean));

    let overlap = 0;
    for (const word of wordsA) {
      if (wordsB.has(word)) overlap++;
    }

    if (overlap > 0) return 0.5;

    return 0;
  }
}

module.exports = EPGService;
