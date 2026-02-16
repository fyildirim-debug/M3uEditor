const crypto = require('crypto');
const db = require('../config/database');
const { createAppError } = require('../utils/AppError');
const M3UFormatter = require('../parsers/M3UFormatter');

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
  async _getOrderedChannels(playlistId) {
    const channels = await db('channels')
      .leftJoin('categories', 'channels.category_id', 'categories.id')
      .where('channels.playlist_id', playlistId)
      .select(
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
  async exportAsM3U(userId, playlistId) {
    await this._verifyPlaylistOwnership(userId, playlistId);
    const channelData = await this._getOrderedChannels(playlistId);
    return this.formatter.format(channelData);
  }

  /**
   * Generate a unique share token for a playlist and store it.
   * @param {string} userId
   * @param {string} playlistId
   * @returns {Promise<{ url: string, token: string }>}
   */
  async generateShareUrl(userId, playlistId) {
    await this._verifyPlaylistOwnership(userId, playlistId);

    const token = crypto.randomBytes(32).toString('hex');

    await db('playlists')
      .where({ id: playlistId })
      .update({ share_token: token, updated_at: db.fn.now() });

    return { url: `/api/shared/${token}`, token };
  }

  /**
   * Get a shared playlist's M3U content by share token.
   * No authentication required.
   * @param {string} shareToken
   * @returns {Promise<string>} M3U formatted content
   */
  async getSharedPlaylist(shareToken) {
    const playlist = await db('playlists')
      .where({ share_token: shareToken })
      .first();

    if (!playlist) {
      throw createAppError('NOT_FOUND');
    }

    const channelData = await this._getOrderedChannels(playlist.id);
    return this.formatter.format(channelData);
  }
}

module.exports = new ExportService();
