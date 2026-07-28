const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { createAppError } = require('../utils/AppError');
const M3UFormatter = require('../parsers/M3UFormatter');
const { hashToken } = require('../utils/crypto');

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
      .where('channels.playlist_id', playlistId);

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
        'categories.name as category_name',
        'categories.sort_order as category_sort_order',
        'channels.sort_order as channel_sort_order'
      )
      .orderByRaw('COALESCE(categories.sort_order, 2147483647) ASC')
      .orderBy('channels.sort_order', 'asc');

    return channels.map((ch) => ({
      name: ch.name,
      logo: ch.logo_url,
      url: ch.stream_url,
      epgId: ch.epg_channel_id,
      group: ch.category_name || null,
      extras: ch.extras || {},
    }));
  }

  /**
   * Export a playlist as an M3U string.
   * Channels are ordered by category sort_order, then channel sort_order.
   * @param {string} userId
   * @param {string} playlistId
   * @returns {Promise<string>} M3U formatted content
   */
  async exportAsM3U(userId, playlistId, excludeCategories = [], streamType = null) {
    await this._verifyPlaylistOwnership(userId, playlistId);
    const channelData = await this._getOrderedChannels(playlistId, excludeCategories, streamType);
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

  _sharedXmltvUrl(shareToken) {
    const appUrl = String(process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    return `${appUrl}/api/shared/${encodeURIComponent(shareToken)}/xmltv`;
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
