const db = require('../config/database');
const { createAppError } = require('../utils/AppError');

const { validateRegex, validateChannelUpdates, CHANNEL_FIELD_LIMITS } = require('../utils/validation');

// Yazilabilir alan listesi ve sinirlari validateChannelUpdates icinde tanimli.
const MAX_RENAME_TERM_BYTES = 1000;

class ChannelService {
  /**
   * Bir oynatma listesindeki sort_order degerlerini 0..n-1 araligina tek bir
   * SQL ifadesiyle sikistirir. Satir basina UPDATE atmak 150k kanalli bir
   * listede tek bir silme/tasima islemini dakikalara cikariyordu.
   * @param {import('knex')} connection - Aktif transaction
   * @param {string} playlistId
   */
  async _compactSortOrder(connection, playlistId) {
    await connection.raw(
      `UPDATE channels AS c
          SET sort_order = ranked.position
         FROM (
           SELECT id, (ROW_NUMBER() OVER (ORDER BY sort_order ASC, id ASC) - 1) AS position
             FROM channels
            WHERE playlist_id = ?
         ) AS ranked
        WHERE c.id = ranked.id
          AND c.sort_order IS DISTINCT FROM ranked.position`,
      [playlistId]
    );
  }
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

  async _verifyCategoryForPlaylist(userId, playlistId, categoryId, connection = db) {
    if (categoryId === null || categoryId === undefined) return null;
    const category = await connection('categories')
      .join('playlists', 'categories.playlist_id', 'playlists.id')
      .where({ 'categories.id': categoryId, 'categories.playlist_id': playlistId, 'playlists.user_id': userId })
      .select('categories.*')
      .first();
    if (!category) throw createAppError('VALIDATION_ERROR', 'Kategori bu oynatma listesine ait değil');
    return category;
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
    const filtered = validateChannelUpdates(updates);
    const ownedChannel = await this._verifyChannelOwnership(userId, channelId);
    if (filtered.category_id !== undefined) {
      await this._verifyCategoryForPlaylist(userId, ownedChannel.playlist_id, filtered.category_id);
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

    // Tasima islemi tek bir SQL ifadesinde yapilir: satirlar uygulamaya
    // getirilmez ve yalnizca konumu gercekten degisen satirlar guncellenir.
    await db.raw(
      `WITH current AS (
         SELECT id, (ROW_NUMBER() OVER (ORDER BY sort_order ASC, id ASC) - 1) AS idx
           FROM channels
          WHERE playlist_id = :playlistId
       ),
       moving AS (SELECT idx FROM current WHERE id = :channelId),
       target AS (
         SELECT LEAST(GREATEST(:newPosition::int, 0), GREATEST((SELECT COUNT(*) FROM current) - 1, 0)) AS idx
       ),
       final AS (
         SELECT c.id,
                CASE
                  WHEN c.id = :channelId THEN (SELECT idx FROM target)
                  WHEN c.idx < (SELECT idx FROM moving) AND c.idx >= (SELECT idx FROM target) THEN c.idx + 1
                  WHEN c.idx > (SELECT idx FROM moving) AND c.idx <= (SELECT idx FROM target) THEN c.idx - 1
                  ELSE c.idx
                END AS position
           FROM current c
       )
       UPDATE channels AS ch
          SET sort_order = final.position, updated_at = NOW()
         FROM final
        WHERE ch.id = final.id
          AND ch.sort_order IS DISTINCT FROM final.position`,
      { playlistId, channelId, newPosition }
    );
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
    const filtered = validateChannelUpdates(updates);

    // Verify all channels belong to user's playlists
    const ownedChannels = await db('channels')
      .join('playlists', 'channels.playlist_id', 'playlists.id')
      .whereIn('channels.id', channelIds)
      .andWhere('playlists.user_id', userId)
      .select('channels.id', 'channels.playlist_id');

    if (ownedChannels.length !== channelIds.length) {
      throw createAppError('NOT_FOUND');
    }

    const playlistIds = [...new Set(ownedChannels.map((channel) => channel.playlist_id))];
    if (filtered.category_id !== undefined) {
      if (playlistIds.length !== 1) throw createAppError('VALIDATION_ERROR', 'Kategori değişikliği tek bir oynatma listesinde yapılabilir');
      await this._verifyCategoryForPlaylist(userId, playlistIds[0], filtered.category_id);
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
      .select('channels.id', 'channels.playlist_id');

    if (ownedChannels.length !== channelIds.length) {
      throw createAppError('NOT_FOUND');
    }

    // Verify target category belongs to user
    const category = await db('categories')
      .join('playlists', 'categories.playlist_id', 'playlists.id')
      .where('categories.id', targetCategoryId)
      .andWhere('playlists.user_id', userId)
      .select('categories.*')
      .first();

    if (!category) {
      throw createAppError('NOT_FOUND');
    }
    if (ownedChannels.some((channel) => channel.playlist_id !== category.playlist_id)) {
      throw createAppError('VALIDATION_ERROR', 'Kanallar yalnızca kendi oynatma listelerindeki kategoriye taşınabilir');
    }

    // Get the maximum sort_order in the target category
    const maxSortOrder = await db('channels')
      .where('category_id', targetCategoryId)
      .max('sort_order as max')
      .first();

    const startSortOrder = (maxSortOrder?.max ?? -1) + 1;

    // Tek ifadede tasi: gonderilen sira korunur, satir basina UPDATE atilmaz.
    await db.raw(
      `UPDATE channels AS c
          SET category_id = :targetCategoryId,
              sort_order = :startSortOrder::int + (v.ordinality - 1),
              updated_at = NOW()
         FROM unnest(:channelIds::uuid[]) WITH ORDINALITY AS v(id, ordinality)
        WHERE c.id = v.id`,
      { targetCategoryId, startSortOrder, channelIds }
    );

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
      await this._compactSortOrder(trx, playlistId);
    });
  }

  async bulkDelete(userId, channelIds) {
    const owned = await db('channels')
      .join('playlists', 'channels.playlist_id', 'playlists.id')
      .whereIn('channels.id', channelIds)
      .andWhere('playlists.user_id', userId)
      .select('channels.id', 'channels.playlist_id');
    if (owned.length !== channelIds.length) throw createAppError('NOT_FOUND');

    await db.transaction(async (trx) => {
      await trx('channels').whereIn('id', channelIds).del();
      for (const playlistId of new Set(owned.map((channel) => channel.playlist_id))) {
        await this._compactSortOrder(trx, playlistId);
      }
    });
    return { deleted: channelIds.length };
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
    if (typeof find !== 'string' || !find.length) throw createAppError('VALIDATION_ERROR', 'Aranacak metin gerekli');
    if (useRegex) validateRegex(find);
    // Sinirsiz `find`/`replace` tek istekte 1000 satiri megabaytlarca veriyle
    // sisirebilirdi; hem girdiler hem de uretilen ad sinirlanir.
    if (Buffer.byteLength(find, 'utf8') > MAX_RENAME_TERM_BYTES || Buffer.byteLength(String(replace ?? ''), 'utf8') > MAX_RENAME_TERM_BYTES) {
      throw createAppError('VALIDATION_ERROR', `Arama ve değiştirme metinleri en fazla ${MAX_RENAME_TERM_BYTES} bayt olabilir`);
    }
    const owned = await db('channels')
      .join('playlists', 'channels.playlist_id', 'playlists.id')
      .whereIn('channels.id', channelIds)
      .andWhere('playlists.user_id', userId)
      .select('channels.id', 'channels.name');

    if (owned.length !== channelIds.length) {
      throw createAppError('NOT_FOUND');
    }

    let renamed = 0;
    await db.transaction(async (trx) => {
      for (const ch of owned) {
        const newName = useRegex ? ch.name.replace(new RegExp(find, 'g'), replace) : ch.name.split(find).join(replace);
        if (Buffer.byteLength(newName, 'utf8') > CHANNEL_FIELD_LIMITS.name) {
          throw createAppError('VALIDATION_ERROR', `Yeniden adlandırma ${CHANNEL_FIELD_LIMITS.name} bayt sınırını aşan bir ad üretiyor`);
        }
        if (newName !== ch.name) {
          await trx('channels').where('id', ch.id).update({ name: newName, updated_at: trx.fn.now() });
          renamed += 1;
        }
      }
    });

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
