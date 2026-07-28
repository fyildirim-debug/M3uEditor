const db = require('../config/database');
const { createAppError } = require('../utils/AppError');

class CategoryService {
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
   * Verify a category belongs to the given user's playlist.
   * Returns the category row (with playlist_id) or throws NOT_FOUND.
   */
  async _verifyCategoryOwnership(userId, categoryId) {
    const category = await db('categories')
      .join('playlists', 'categories.playlist_id', 'playlists.id')
      .where('categories.id', categoryId)
      .andWhere('playlists.user_id', userId)
      .select('categories.*')
      .first();

    if (!category) {
      throw createAppError('NOT_FOUND');
    }
    return category;
  }

  /**
   * List all categories for a playlist ordered by sort_order, with channel counts.
   * @param {string} [streamType] - Filter categories by stream_type (only show categories that have channels of this type)
   */
  async list(userId, playlistId, streamType) {
    await this._verifyPlaylistOwnership(userId, playlistId);

    let query = db('categories')
      .leftJoin('channels', function () {
        this.on('categories.id', 'channels.category_id');
        if (streamType) {
          this.andOn('channels.stream_type', db.raw('?', [streamType]));
        }
      })
      .where('categories.playlist_id', playlistId)
      .groupBy('categories.id')
      .orderBy('categories.sort_order', 'asc')
      .orderBy('categories.id', 'asc')
      .select('categories.*', db.raw('count(channels.id)::int as channel_count'));

    if (streamType) {
      query = query.having(db.raw('count(channels.id)'), '>', 0);
    }

    return query;
  }

  /**
   * Create a new category with sort_order = max(sort_order) + 1.
   */
  async create(userId, playlistId, name) {
    await this._verifyPlaylistOwnership(userId, playlistId);

    const maxResult = await db('categories')
      .where('playlist_id', playlistId)
      .max('sort_order as max_order')
      .first();

    const sortOrder = (maxResult && maxResult.max_order !== null)
      ? maxResult.max_order + 1
      : 0;

    const [category] = await db('categories')
      .insert({ playlist_id: playlistId, name, sort_order: sortOrder })
      .returning('*');

    return category;
  }

  /**
   * Update a category's name.
   */
  async update(userId, categoryId, name) {
    await this._verifyCategoryOwnership(userId, categoryId);

    await db('categories').where('id', categoryId).update({ name });

    const category = await db('categories').where('id', categoryId).first();
    return category;
  }

  /**
   * Move a category immediately before or after another category in the same
   * playlist. This is safe when the category view is filtered by stream type.
   */
  async updateOrder(userId, categoryId, relativePosition = {}) {
    if (!relativePosition || typeof relativePosition !== 'object' || Array.isArray(relativePosition)) {
      throw createAppError('VALIDATION_ERROR', 'Geçerli bir göreli sıralama konumu gönderin');
    }
    const { afterCategoryId, beforeCategoryId } = relativePosition;
    const hasAfter = afterCategoryId !== undefined;
    const hasBefore = beforeCategoryId !== undefined;
    if (hasAfter === hasBefore) {
      throw createAppError('VALIDATION_ERROR', 'afterCategoryId veya beforeCategoryId alanlarından yalnızca biri gönderilmelidir');
    }

    const referenceCategoryId = hasAfter ? afterCategoryId : beforeCategoryId;
    if (typeof referenceCategoryId !== 'string' || !referenceCategoryId.trim() || referenceCategoryId.length > 200) {
      throw createAppError('VALIDATION_ERROR', 'Geçerli bir referans kategori kimliği gönderin');
    }

    const category = await this._verifyCategoryOwnership(userId, categoryId);
    if (referenceCategoryId === categoryId) {
      throw createAppError('VALIDATION_ERROR', 'Bir kategori kendisine göre sıralanamaz');
    }

    const referenceCategory = await this._verifyCategoryOwnership(userId, referenceCategoryId);
    const playlistId = category.playlist_id;
    if (referenceCategory.playlist_id !== playlistId) {
      throw createAppError('VALIDATION_ERROR', 'Referans kategori aynı oynatma listesine ait olmalıdır');
    }

    await db.raw(
      `WITH current AS (
         SELECT id, (ROW_NUMBER() OVER (ORDER BY sort_order ASC, id ASC) - 1) AS idx
           FROM categories
          WHERE playlist_id = :playlistId
       ),
       positions AS (
         SELECT (SELECT idx FROM current WHERE id = :categoryId) AS moving_idx,
                (SELECT idx FROM current WHERE id = :referenceCategoryId) AS reference_idx
       ),
       target AS (
         SELECT CASE
                  WHEN :placement = 'before' THEN reference_idx - CASE WHEN moving_idx < reference_idx THEN 1 ELSE 0 END
                  ELSE reference_idx + CASE WHEN moving_idx > reference_idx THEN 1 ELSE 0 END
                END AS idx
           FROM positions
       ),
       final AS (
         SELECT c.id,
                CASE
                  WHEN c.id = :categoryId THEN (SELECT idx FROM target)
                  WHEN c.idx < (SELECT moving_idx FROM positions) AND c.idx >= (SELECT idx FROM target) THEN c.idx + 1
                  WHEN c.idx > (SELECT moving_idx FROM positions) AND c.idx <= (SELECT idx FROM target) THEN c.idx - 1
                  ELSE c.idx
                END AS position
           FROM current c
       )
       UPDATE categories AS cat
          SET sort_order = final.position
         FROM final
        WHERE cat.id = final.id
          AND cat.sort_order IS DISTINCT FROM final.position`,
      {
        playlistId,
        categoryId,
        referenceCategoryId,
        placement: hasAfter ? 'after' : 'before',
      }
    );
  }

  /**
   * Delete a category:
   * 1. Move all channels in this category to category_id = null (Kategorisiz)
   * 2. Delete the category
   * 3. Recompact sort_order for remaining categories
   * Uses a transaction for consistency.
   */
  async delete(userId, categoryId) {
    const category = await this._verifyCategoryOwnership(userId, categoryId);
    const playlistId = category.playlist_id;

    await db.transaction(async (trx) => {
      // Move channels to "Kategorisiz" (null category)
      await trx('channels')
        .where('category_id', categoryId)
        .update({ category_id: null, updated_at: trx.fn.now() });

      // Delete the category
      await trx('categories').where('id', categoryId).del();

      // Recompact sort_order for remaining categories
      const remaining = await trx('categories')
        .where('playlist_id', playlistId)
        .orderBy('sort_order', 'asc')
        .select('id');

      for (let i = 0; i < remaining.length; i++) {
        await trx('categories')
          .where('id', remaining[i].id)
          .update({ sort_order: i });
      }
    });
  }
}

module.exports = new CategoryService();
