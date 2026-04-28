const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { createAppError } = require('../utils/AppError');

class PlaylistService {
  /**
   * List all playlists for a user, ordered by created_at desc.
   * @param {string} userId
   * @returns {Promise<object[]>}
   */
  async list(userId) {
    const channelCountSub = db('channels')
      .select('playlist_id')
      .count('id as channel_count')
      .groupBy('playlist_id')
      .as('cc');

    const playlists = await db('playlists')
      .leftJoin(channelCountSub, 'cc.playlist_id', 'playlists.id')
      .where('playlists.user_id', userId)
      .select(
        'playlists.*',
        db.raw('COALESCE(cc.channel_count, 0)::int as channel_count')
      )
      .orderBy('playlists.created_at', 'desc');

    return playlists;
  }

  /**
   * Create a new playlist for the user.
   * @param {string} userId
   * @param {{ name: string }} data
   * @returns {Promise<object>}
   */
  async create(userId, { name }) {
    const [playlist] = await db('playlists')
      .insert({
        id: uuidv4(),
        user_id: userId,
        name,
      })
      .returning('*');

    return playlist;
  }

  /**
   * Update a playlist's name. Verifies ownership.
   * @param {string} userId
   * @param {string} playlistId
   * @param {{ name: string }} data
   * @returns {Promise<object>}
   */
  async update(userId, playlistId, { name }) {
    const playlist = await db('playlists')
      .where({ id: playlistId, user_id: userId })
      .first();

    if (!playlist) {
      throw createAppError('NOT_FOUND');
    }

    await db('playlists')
      .where('id', playlistId)
      .update({ name, updated_at: db.fn.now() });

    const updated = await db('playlists')
      .where('id', playlistId)
      .first();

    return updated;
  }

  /**
   * Delete a playlist and all associated data.
   * Categories and channels cascade via DB foreign keys (ON DELETE CASCADE).
   * Verifies ownership before deletion.
   * @param {string} userId
   * @param {string} playlistId
   */
  async delete(userId, playlistId) {
    const playlist = await db('playlists')
      .where({ id: playlistId, user_id: userId })
      .first();

    if (!playlist) {
      throw createAppError('NOT_FOUND');
    }

    await db('playlists').where('id', playlistId).del();
  }
}

module.exports = new PlaylistService();
