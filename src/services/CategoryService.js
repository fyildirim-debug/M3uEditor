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
   */
  async list(userId, playlistId) {
    await this._verifyPlaylistOwnership(userId, playlistId);

    const categories = await db('categories')
      .leftJoin('channels', 'categories.id', 'channels.category_id')
      .where('categories.playlist_id', playlistId)
      .groupBy('categories.id')
      .orderBy('categories.sort_order', 'asc')
      .select('categories.*', db.raw('count(channels.id)::int as channel_count'));

    return categories;
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
   * Move a category to a new position (0-based) and recompact sort_order.
   * Uses a transaction for consistency.
   */
  async updateOrder(userId, categoryId, newPosition) {
    const category = await this._verifyCategoryOwnership(userId, categoryId);
    const playlistId = category.playlist_id;

    await db.transaction(async (trx) => {
      const allCategories = await trx('categories')
        .where('playlist_id', playlistId)
        .orderBy('sort_order', 'asc')
        .select('id', 'sort_order');

      // Remove the moving category from the list
      const filtered = allCategories.filter((c) => c.id !== categoryId);

      // Clamp newPosition
      const clampedPos = Math.max(0, Math.min(newPosition, filtered.length));

      // Insert at new position
      filtered.splice(clampedPos, 0, { id: categoryId });

      // Update sort_order for all categories
      for (let i = 0; i < filtered.length; i++) {
        await trx('categories')
          .where('id', filtered[i].id)
          .update({ sort_order: i });
      }
    });
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
