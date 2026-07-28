const db = require('../config/database');
const { createAppError } = require('../utils/AppError');
const XMLTVFormatter = require('../parsers/XMLTVFormatter');
const { toAbsoluteMediaUrl } = require('../utils/urls');

const DEFAULT_DAYS = 7;
const MAX_DAYS = 14;
const PROGRAM_BATCH_SIZE = 1000;

class XMLTVExportService {
  constructor() {
    this.formatter = new XMLTVFormatter();
  }

  normalizeDays(value) {
    if (value === undefined || value === null || value === '') return DEFAULT_DAYS;
    if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d+$/.test(String(value))) {
      throw createAppError('VALIDATION_ERROR', 'Gün sayısı 1-14 arasında olmalı');
    }

    const days = Number(value);
    if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
      throw createAppError('VALIDATION_ERROR', 'Gün sayısı 1-14 arasında olmalı');
    }
    return days;
  }

  async _verifyPlaylistOwnership(userId, playlistId) {
    const playlist = await db('playlists').where({ id: playlistId, user_id: userId }).first();
    if (!playlist) throw createAppError('NOT_FOUND');
    return playlist;
  }

  async _getMatchedChannels(playlistId) {
    const result = await db.raw(`
      SELECT matched.channel_id, matched.name, matched.icon_url, matched.epg_channel_uuid
      FROM (
        SELECT DISTINCT ON (c.epg_channel_id)
          c.epg_channel_id AS channel_id,
          c.name,
          COALESCE(c.logo_url, ec.icon_url) AS icon_url,
          ec.id AS epg_channel_uuid
        FROM channels AS c
        JOIN playlists AS pl ON pl.id = c.playlist_id
        JOIN epg_channels AS ec ON ec.channel_id = c.epg_channel_id
        JOIN epg_sources AS es ON es.id = ec.source_id AND es.user_id = pl.user_id
        WHERE c.playlist_id = ?
          AND c.epg_channel_id IS NOT NULL
          AND c.epg_channel_id <> ''
          AND (c.epg_source_id IS NULL OR ec.source_id = c.epg_source_id)
        ORDER BY c.epg_channel_id,
          (ec.source_id = c.epg_source_id) DESC NULLS LAST,
          c.sort_order,
          c.id,
          ec.source_id
      ) AS matched
      ORDER BY matched.channel_id
    `, [playlistId]);

    return result.rows.map((row) => ({
      id: row.channel_id,
      name: row.name,
      icon: toAbsoluteMediaUrl(row.icon_url),
      epgChannelUuid: row.epg_channel_uuid,
    }));
  }

  async *_getProgrammes(matchedChannels, startTime, endTime) {
    if (matchedChannels.length === 0) return;

    const epgChannelIds = matchedChannels.map((channel) => channel.epgChannelUuid);
    let cursor = null;

    while (true) {
      const cursorClause = cursor
        ? 'AND (p.start_time > ? OR (p.start_time = ? AND p.id > ?::uuid))'
        : '';
      const bindings = [epgChannelIds, endTime, startTime];
      if (cursor) bindings.push(cursor.startTime, cursor.startTime, cursor.id);
      bindings.push(PROGRAM_BATCH_SIZE);

      const result = await db.raw(`
        SELECT p.id, p.start_time, p.end_time, p.title, p.description, ec.channel_id
        FROM epg_programs AS p
        JOIN epg_channels AS ec ON ec.id = p.epg_channel_id
        WHERE p.epg_channel_id = ANY(?::uuid[])
          AND p.start_time < ?
          AND (p.end_time IS NULL OR p.end_time >= ?)
          ${cursorClause}
        ORDER BY p.start_time, p.id
        LIMIT ?
      `, bindings);

      for (const row of result.rows) {
        yield {
          start: row.start_time,
          stop: row.end_time,
          channelId: row.channel_id,
          title: row.title,
          description: row.description,
        };
      }

      if (result.rows.length < PROGRAM_BATCH_SIZE) return;
      const last = result.rows[result.rows.length - 1];
      cursor = { startTime: last.start_time, id: last.id };
    }
  }

  async _createStream(playlistId, requestedDays) {
    const days = this.normalizeDays(requestedDays);
    const channels = await this._getMatchedChannels(playlistId);
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + days * 24 * 60 * 60 * 1000);
    const programmes = this._getProgrammes(channels, startTime, endTime);
    return this.formatter.formatStream(channels, programmes);
  }

  async createAuthenticatedStream(userId, playlistId, days) {
    await this._verifyPlaylistOwnership(userId, playlistId);
    return this._createStream(playlistId, days);
  }

  async createSharedStream(playlist, days) {
    if (!playlist || !playlist.id) throw createAppError('NOT_FOUND');
    return this._createStream(playlist.id, days);
  }

  async getCoverage(userId, playlistId) {
    await this._verifyPlaylistOwnership(userId, playlistId);
    const result = await db.raw(`
      SELECT
        COUNT(*)::integer AS total_channels,
        COUNT(*) FILTER (WHERE matched.epg_channel_uuid IS NOT NULL)::integer AS matched_channels,
        COUNT(*) FILTER (
          WHERE matched.epg_channel_uuid IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM epg_programs AS p
              WHERE p.epg_channel_id = matched.epg_channel_uuid
            )
        )::integer AS channels_with_programs
      FROM channels AS c
      JOIN playlists AS pl ON pl.id = c.playlist_id
      LEFT JOIN LATERAL (
        SELECT ec.id AS epg_channel_uuid
        FROM epg_channels AS ec
        JOIN epg_sources AS es ON es.id = ec.source_id AND es.user_id = pl.user_id
        WHERE ec.channel_id = c.epg_channel_id
          AND (c.epg_source_id IS NULL OR ec.source_id = c.epg_source_id)
        ORDER BY (ec.source_id = c.epg_source_id) DESC NULLS LAST, ec.source_id
        LIMIT 1
      ) AS matched ON TRUE
      WHERE c.playlist_id = ?
    `, [playlistId]);
    const row = result.rows[0];
    return {
      totalChannels: Number(row.total_channels),
      matchedChannels: Number(row.matched_channels),
      channelsWithPrograms: Number(row.channels_with_programs),
    };
  }
}

module.exports = new XMLTVExportService();
