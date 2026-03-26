const db = require('../config/database');
const { createAppError } = require('../utils/AppError');

const ALLOWED_UPDATE_FIELDS = ['name', 'logo_url', 'epg_channel_id', 'category_id', 'stream_url'];

class ChannelService {
  /**
   * Verify a channel belongs to the given user via playlists join.
   * Returns the channel row or throws NOT_FOUND.
   */
  async _verifyChannelOwnership(userId, channelId) {
    const channel = await db('channels')
      .join('playlists', 'channels.playlist_id', 'playlists.id')
      .where('channels.id', channelId)
      .andWhere('playlists.user_id', userId)
      .select('channels.*')
      .first();

    if (!channel) {
      throw createAppError('NOT_FOUND');
    }
    return channel;
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
   * List channels with pagination, search, and category filter.
   * @param {string} userId
   * @param {string} playlistId
   * @param {{ page?: number, limit?: number, search?: string, categoryId?: string }} options
   * @returns {Promise<{ channels: object[], total: number }>}
   */
  async list(userId, playlistId, { page = 1, limit = 100, search, categoryId, streamType } = {}) {
    await this._verifyPlaylistOwnership(userId, playlistId);

    const query = db('channels')
      .where('channels.playlist_id', playlistId);

    if (streamType) {
      query.andWhere('channels.stream_type', streamType);
    }

    if (categoryId) {
      query.andWhere('channels.category_id', categoryId);
    }

    if (search) {
      query.andWhere(function () {
        this.whereRaw('channels.name % ?', [search])
          .orWhereRaw('channels.name ILIKE ?', [`%${search}%`]);
      });
    }

    const countQuery = query.clone().count('* as count').first();
    const { count } = await countQuery;
    const total = parseInt(count, 10);

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const channels = await query
      .clone()
      .leftJoin('categories', 'channels.category_id', 'categories.id')
      .select('channels.*', 'categories.name as category_name')
      .orderBy('channels.sort_order', 'asc')
      .limit(limit)
      .offset(offset);

    return { channels, total, totalPages };
  }

  /**
   * Update allowed fields on a channel.
   * @param {string} userId
   * @param {string} channelId
   * @param {object} updates
   * @returns {Promise<object>} Updated channel
   */
  async update(userId, channelId, updates) {
    await this._verifyChannelOwnership(userId, channelId);

    const filtered = {};
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (updates[key] !== undefined) {
        filtered[key] = updates[key];
      }
    }

    if (Object.keys(filtered).length > 0) {
      filtered.updated_at = db.fn.now();
      await db('channels').where('id', channelId).update(filtered);
    }

    const channel = await db('channels').where('id', channelId).first();
    return channel;
  }

  /**
   * Move a channel to a new position (0-based) and recompact sort_order.
   * @param {string} userId
   * @param {string} channelId
   * @param {number} newPosition - 0-based target position
   */
  async updateOrder(userId, channelId, newPosition) {
    const channel = await this._verifyChannelOwnership(userId, channelId);
    const playlistId = channel.playlist_id;

    await db.transaction(async (trx) => {
      // Get all channels in the playlist ordered by sort_order
      const allChannels = await trx('channels')
        .where('playlist_id', playlistId)
        .orderBy('sort_order', 'asc')
        .select('id', 'sort_order');

      // Remove the moving channel from the list
      const filtered = allChannels.filter((c) => c.id !== channelId);

      // Clamp newPosition
      const clampedPos = Math.max(0, Math.min(newPosition, filtered.length));

      // Insert at new position
      filtered.splice(clampedPos, 0, { id: channelId });

      // Bulk update sort_order using a single query with CASE
      if (filtered.length > 0) {
        const cases = filtered.map((c, i) => `WHEN '${c.id}' THEN ${i}`).join(' ');
        const ids = filtered.map(c => `'${c.id}'`).join(',');
        await trx.raw(`UPDATE channels SET sort_order = CASE id ${cases} END WHERE id IN (${ids})`);
      }
    });
  }

  /**
   * Bulk update allowed fields for multiple channels.
   * @param {string} userId
   * @param {string[]} channelIds
   * @param {object} updates
   * @returns {Promise<{ updated: number }>}
   */
  async bulkUpdate(userId, channelIds, updates) {
    if (!channelIds || channelIds.length === 0) {
      return { updated: 0 };
    }

    // Verify all channels belong to user's playlists
    const ownedChannels = await db('channels')
      .join('playlists', 'channels.playlist_id', 'playlists.id')
      .whereIn('channels.id', channelIds)
      .andWhere('playlists.user_id', userId)
      .select('channels.id');

    if (ownedChannels.length !== channelIds.length) {
      throw createAppError('NOT_FOUND');
    }

    const filtered = {};
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (updates[key] !== undefined) {
        filtered[key] = updates[key];
      }
    }

    if (Object.keys(filtered).length === 0) {
      return { updated: 0 };
    }

    filtered.updated_at = db.fn.now();
    const updated = await db('channels')
      .whereIn('id', channelIds)
      .update(filtered);

    return { updated };
  }

  /**
   * Bulk move channels to a target category.
   * Channels are moved to the end of the target category.
   * @param {string} userId
   * @param {string[]} channelIds
   * @param {string} targetCategoryId
   * @returns {Promise<{ moved: number }>}
   */
  async bulkMove(userId, channelIds, targetCategoryId) {
    if (!channelIds || channelIds.length === 0) {
      return { moved: 0 };
    }

    // Verify all channels belong to user
    const ownedChannels = await db('channels')
      .join('playlists', 'channels.playlist_id', 'playlists.id')
      .whereIn('channels.id', channelIds)
      .andWhere('playlists.user_id', userId)
      .select('channels.id');

    if (ownedChannels.length !== channelIds.length) {
      throw createAppError('NOT_FOUND');
    }

    // Verify target category belongs to user
    const category = await db('categories')
      .join('playlists', 'categories.playlist_id', 'playlists.id')
      .where('categories.id', targetCategoryId)
      .andWhere('playlists.user_id', userId)
      .first();

    if (!category) {
      throw createAppError('NOT_FOUND');
    }

    // Get the maximum sort_order in the target category
    const maxSortOrder = await db('channels')
      .where('category_id', targetCategoryId)
      .max('sort_order as max')
      .first();

    const startSortOrder = (maxSortOrder?.max ?? -1) + 1;

    // Update channels with new category_id and sort_order (move to end of category)
    await db.transaction(async (trx) => {
      for (let i = 0; i < channelIds.length; i++) {
        await trx('channels')
          .where('id', channelIds[i])
          .update({
            category_id: targetCategoryId,
            sort_order: startSortOrder + i,
            updated_at: db.fn.now()
          });
      }
    });

    return { moved: channelIds.length };
  }

  /**
   * Delete a channel and recompact sort_order for remaining channels.
   * @param {string} userId
   * @param {string} channelId
   */
  async delete(userId, channelId) {
    const channel = await this._verifyChannelOwnership(userId, channelId);
    const playlistId = channel.playlist_id;

    await db.transaction(async (trx) => {
      await trx('channels').where('id', channelId).del();

      // Recompact sort_order for remaining channels in the same playlist
      const remaining = await trx('channels')
        .where('playlist_id', playlistId)
        .orderBy('sort_order', 'asc')
        .select('id');

      if (remaining.length > 0) {
        const cases = remaining.map((c, i) => `WHEN '${c.id}' THEN ${i}`).join(' ');
        const ids = remaining.map(c => `'${c.id}'`).join(',');
        await trx.raw(`UPDATE channels SET sort_order = CASE id ${cases} END WHERE id IN (${ids})`);
      }
    });
  }

  /**
   * Reset a channel to its original Xtream Codes values (name + logo).
   * @param {string} userId
   * @param {string} channelId
   * @returns {Promise<object>} Updated channel
   */
  async reset(userId, channelId) {
    const channel = await this._verifyChannelOwnership(userId, channelId);

    await db('channels').where('id', channelId).update({
      name: channel.original_name || channel.name,
      logo_url: channel.original_logo_url !== undefined ? channel.original_logo_url : channel.logo_url,
      updated_at: db.fn.now(),
    });

    return db('channels').where('id', channelId).first();
  }

  /**
   * Bulk rename channels using find/replace.
   * @param {string} userId
   * @param {string[]} channelIds
   * @param {string} find - text to find
   * @param {string} replace - replacement text
   * @param {boolean} useRegex - treat find as regex
   * @returns {Promise<{ renamed: number, total: number }>}
   */
  async bulkRename(userId, channelIds, find, replace = '', useRegex = false) {
    const owned = await db('channels')
      .join('playlists', 'channels.playlist_id', 'playlists.id')
      .whereIn('channels.id', channelIds)
      .andWhere('playlists.user_id', userId)
      .select('channels.id', 'channels.name');

    if (owned.length !== channelIds.length) {
      throw createAppError('NOT_FOUND');
    }

    let renamed = 0;
    for (const ch of owned) {
      let newName;
      if (useRegex) {
        const regex = new RegExp(find, 'g');
        newName = ch.name.replace(regex, replace);
      } else {
        newName = ch.name.split(find).join(replace);
      }

      if (newName !== ch.name) {
        await db('channels').where('id', ch.id).update({ name: newName, updated_at: new Date() });
        renamed++;
      }
    }

    return { renamed, total: channelIds.length };
  }

  /**
   * Trigram-based search on channel name.
   * @param {string} userId
   * @param {string} playlistId
   * @param {string} query
   * @returns {Promise<object[]>}
   */
  async search(userId, playlistId, query) {
    await this._verifyPlaylistOwnership(userId, playlistId);

    const channels = await db('channels')
      .where('channels.playlist_id', playlistId)
      .andWhere(function () {
        this.whereRaw('channels.name % ?', [query])
          .orWhereRaw('channels.name ILIKE ?', [`%${query}%`]);
      })
      .select('channels.*')
      .orderByRaw('similarity(channels.name, ?) DESC', [query]);

    return channels;
  }
}

module.exports = new ChannelService();
