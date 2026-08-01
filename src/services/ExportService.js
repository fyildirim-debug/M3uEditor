const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { createAppError } = require('../utils/AppError');
const M3UFormatter = require('../parsers/M3UFormatter');
const { hashToken } = require('../utils/crypto');
const { toAbsoluteMediaUrl } = require('../utils/urls');
const config = require('../config');

class ExportService {
  constructor() {
    this.formatter = new M3UFormatter();
  }

  /**
   * Verify a playlist belongs to the given user.
   * Returns the playlist row or throws NOT_FOUND.
   */
  async _verifyPlaylistOwnership(userId, playlistId) {
    const playlist = await db('playlists')
      .where({ id: playlistId, user_id: userId })
      .first();

    if (!playlist) {
      throw createAppError('NOT_FOUND');
    }
    return playlist;
  }

  /**
   * Fetch channels for a playlist ordered by category sort_order then channel sort_order,
   * and map them to M3UFormatter's ChannelData format.
   */
  async _getOrderedChannels(playlistId, excludeCategories = [], streamType = null) {
    let query = db('channels')
      .leftJoin('categories', 'channels.category_id', 'categories.id')
      .where('channels.playlist_id', playlistId)
      .where(function () {
        // A NULL category remains output-visible. Writing this as a plain
        // categories.is_hidden = false predicate would turn the LEFT JOIN into
        // an effective INNER JOIN and silently drop uncategorized channels.
        this.whereNull('channels.category_id').orWhere('categories.is_hidden', false);
      });

    if (excludeCategories.length > 0) {
      // NOT IN, category_id NULL olan satirlar icin NULL dondurur; acik NULL
      // kontrolu olmadan kategorisiz kanallar da disarida kalirdi.
      query = query.where(function () {
        this.whereNull('channels.category_id').orWhereNotIn('channels.category_id', excludeCategories);
      });
    }

    if (streamType) {
      query = query.where('channels.stream_type', streamType);
    }

    const channels = await query.select(
        'channels.name',
        'channels.logo_url',
        'channels.stream_url',
        'channels.epg_channel_id',
        'channels.extras',
        'channels.xtream_id',
        'channels.stream_type',
        'categories.name as category_name',
        'categories.sort_order as category_sort_order',
        'channels.sort_order as channel_sort_order'
      )
      .orderByRaw('COALESCE(categories.sort_order, 2147483647) ASC')
      .orderBy('channels.sort_order', 'asc');

    return channels.map((ch) => ({
      name: ch.name,
      // Yuklenen logolar goreli saklanir; player mutlak adres bekler.
      logo: toAbsoluteMediaUrl(ch.logo_url),
      url: ch.stream_url,
      epgId: ch.epg_channel_id,
      group: ch.category_name || null,
      extras: ch.extras || {},
      xtreamId: ch.xtream_id,
      streamType: ch.stream_type,
    }));
  }

  _xtreamExtension(channel, liveOutput) {
    if (channel.streamType === 'live') return liveOutput === 'm3u8' ? 'm3u8' : 'ts';
    const explicit = channel.extras?.container_extension || channel.extras?.containerExtension;
    if (typeof explicit === 'string' && /^[a-z0-9]{1,10}$/i.test(explicit)) return explicit.toLowerCase();
    try {
      return new URL(channel.url).pathname.match(/\.([a-z0-9]{1,10})$/i)?.[1]?.toLowerCase() || 'mp4';
    } catch (_error) {
      return 'mp4';
    }
  }

  /**
   * Format an already-authorized Xtream output playlist with local playback
   * routes. Authentication is resolved by XtreamOutputService before this call.
   */
  async createXtreamPlaylist(playlist, username, password, output = 'ts') {
    if (!playlist?.id) throw createAppError('NOT_FOUND');
    const baseUrl = config.appUrl;
    const channels = await this._getOrderedChannels(playlist.id);
    const localChannels = channels.map((channel) => {
      const pathType = channel.streamType === 'vod' ? 'movie' : channel.streamType === 'series' ? 'series' : 'live';
      const extension = this._xtreamExtension(channel, output);
      return {
        ...channel,
        url: `${baseUrl}/${pathType}/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${encodeURIComponent(channel.xtreamId)}.${encodeURIComponent(extension)}`,
      };
    });
    return this.formatter.format(localChannels);
  }

  /**
   * Export a playlist as an M3U string.
   * Channels are ordered by category sort_order, then channel sort_order.
   * Opsiyonel `viewId` verilirse gorunumun hidden_category_ids listesi,
   * kategorinin kendi is_hidden bayragiyla birlesik dislama olarak uygulanir.
   * @param {string} userId
   * @param {string} playlistId
   * @returns {Promise<string>} M3U formatted content
   */
  async exportAsM3U(userId, playlistId, excludeCategories = [], streamType = null, viewId = null) {
    await this._verifyPlaylistOwnership(userId, playlistId);

    let mergedExclusions = excludeCategories;
    if (viewId) {
      const view = await db('playlist_views')
        .where({ id: viewId, playlist_id: playlistId })
        .first();
      if (!view) {
        throw createAppError('NOT_FOUND');
      }
      const viewHidden = Array.isArray(view.hidden_category_ids) ? view.hidden_category_ids : [];
      mergedExclusions = [...new Set([...excludeCategories, ...viewHidden])];
    }

    const channelData = await this._getOrderedChannels(playlistId, mergedExclusions, streamType);
    return this.formatter.format(channelData);
  }

  /**
   * Generate a unique share token for a playlist and store it.
   * @param {string} userId
   * @param {string} playlistId
   * @returns {Promise<{ url: string, xmltvUrl: string, token: string }>}
   */
  async generateShareUrl(userId, playlistId, { expiresInDays, password } = {}) {
    await this._verifyPlaylistOwnership(userId, playlistId);

    const token = crypto.randomBytes(32).toString('hex');
    const updates = { share_token: hashToken(token), updated_at: db.fn.now() };

    if (expiresInDays) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      updates.share_expires_at = expiresAt;
    } else {
      updates.share_expires_at = null;
    }

    updates.share_password = password ? await bcrypt.hash(String(password), 12) : null;

    await db('playlists').where({ id: playlistId }).update(updates);
    return {
      url: `/api/shared/${token}`,
      xmltvUrl: `/api/shared/${token}/xmltv`,
      token,
    };
  }

  /**
   * Revoke a playlist's share link: clears token, expiry and password.
   * @param {string} userId
   * @param {string} playlistId
   */
  async revokeShare(userId, playlistId) {
    await this._verifyPlaylistOwnership(userId, playlistId);
    await db('playlists').where({ id: playlistId }).update({
      share_token: null,
      share_expires_at: null,
      share_password: null,
      updated_at: db.fn.now(),
    });
  }

  _sharedXmltvUrl(shareToken) {
    return `${config.appUrl}/api/shared/${encodeURIComponent(shareToken)}/xmltv`;
  }

  /**
   * Resolve and authorize a public share. Both M3U and XMLTV exports call this
   * helper so token hashing, legacy migration, expiry and password rules cannot
   * drift apart.
   */
  async resolveSharedPlaylist(shareToken, password) {
    let playlist = await db('playlists').where({ share_token: hashToken(shareToken) }).first();
    if (!playlist) playlist = await db('playlists').where({ share_token: shareToken }).first(); // legacy

    if (!playlist) {
      throw createAppError('NOT_FOUND');
    }

    if (playlist.share_expires_at && new Date(playlist.share_expires_at) < new Date()) {
      throw createAppError('FORBIDDEN', 'Paylasim linkinin suresi dolmus');
    }

    if (playlist.share_password) {
      const valid = playlist.share_password.startsWith('$2')
        ? await bcrypt.compare(String(password || ''), playlist.share_password)
        : playlist.share_password === password;
      if (!valid) throw createAppError('INVALID_CREDENTIALS', 'Paylaşım şifresi yanlış');
      if (!playlist.share_password.startsWith('$2')) {
        await db('playlists').where({ id: playlist.id }).update({ share_password: await bcrypt.hash(String(password), 12) });
      }
    }

    return playlist;
  }

  /**
   * Get a shared playlist's M3U content by share token.
   * No authentication required.
   * @param {string} shareToken
   * @returns {Promise<string>} M3U formatted content
   */
  async getSharedPlaylist(shareToken, password) {
    const playlist = await this.resolveSharedPlaylist(shareToken, password);
    const channelData = await this._getOrderedChannels(playlist.id);
    return this.formatter.format(channelData, { urlTvg: this._sharedXmltvUrl(shareToken) });
  }
}

module.exports = new ExportService();
