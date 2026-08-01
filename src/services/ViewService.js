const { validate: validateUuid } = require('uuid');
const db = require('../config/database');
const { createAppError } = require('../utils/AppError');

const MAX_HIDDEN_IDS = 1000;

/**
 * Gorunum sablonlari: bir playlist icin "hangi kategoriler gizli" bilgisini
 * isimli profiller halinde saklar. Export sirasinda gorunumun
 * hidden_category_ids listesi, kategorinin kendi is_hidden bayragiyla
 * birlesik dislama olarak uygulanir.
 */
class ViewService {
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
   * Verify a view belongs to a playlist owned by the given user.
   * playlist_views tablosunda user_id yok; tenant sinirini playlists
   * uzerinden kurar.
   */
  async _verifyViewOwnership(userId, viewId) {
    const view = await db('playlist_views')
      .join('playlists', 'playlist_views.playlist_id', 'playlists.id')
      .where('playlist_views.id', viewId)
      .where('playlists.user_id', userId)
      .first('playlist_views.*');

    if (!view) {
      throw createAppError('NOT_FOUND');
    }
    return view;
  }

  _validateName(name) {
    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 255) {
      throw createAppError('VALIDATION_ERROR', 'name alanı zorunludur ve 255 karakteri geçemez');
    }
    return name.trim();
  }

  /**
   * hidden_category_ids dizisini dogrular ve yalnizca bu playlist'e ait
   * kategori kimliklerini tutar. Baska tenant'a ait ya da silinmis
   * kimlikler sessizce dusurulur; boylece jsonb icinde yabanci veri birikmez.
   */
  async _normalizeHiddenIds(playlistId, hiddenCategoryIds) {
    if (hiddenCategoryIds === undefined || hiddenCategoryIds === null) return [];
    if (!Array.isArray(hiddenCategoryIds) || hiddenCategoryIds.length > MAX_HIDDEN_IDS) {
      throw createAppError('VALIDATION_ERROR', `hidden_category_ids 0-${MAX_HIDDEN_IDS} arası kimlik listesi olmalıdır`);
    }
    const ids = [...new Set(hiddenCategoryIds)];
    if (ids.some((id) => typeof id !== 'string' || !validateUuid(id))) {
      throw createAppError('VALIDATION_ERROR', 'hidden_category_ids geçerli kategori kimlikleri içermelidir');
    }
    if (ids.length === 0) return [];

    const rows = await db('categories')
      .where('playlist_id', playlistId)
      .whereIn('id', ids)
      .select('id');
    const valid = new Set(rows.map((row) => row.id));
    return ids.filter((id) => valid.has(id));
  }

  async list(userId, playlistId) {
    await this._verifyPlaylistOwnership(userId, playlistId);
    return db('playlist_views')
      .where('playlist_id', playlistId)
      .orderBy('created_at', 'asc');
  }

  async create(userId, playlistId, { name, hiddenCategoryIds } = {}) {
    await this._verifyPlaylistOwnership(userId, playlistId);
    const cleanName = this._validateName(name);
    const ids = await this._normalizeHiddenIds(playlistId, hiddenCategoryIds);

    const [view] = await db('playlist_views')
      .insert({
        playlist_id: playlistId,
        name: cleanName,
        hidden_category_ids: JSON.stringify(ids),
      })
      .returning('*');
    return view;
  }

  async update(userId, viewId, { name, hiddenCategoryIds } = {}) {
    const view = await this._verifyViewOwnership(userId, viewId);

    const updates = {};
    if (name !== undefined) {
      updates.name = this._validateName(name);
    }
    if (hiddenCategoryIds !== undefined) {
      const ids = await this._normalizeHiddenIds(view.playlist_id, hiddenCategoryIds);
      updates.hidden_category_ids = JSON.stringify(ids);
    }
    if (Object.keys(updates).length === 0) {
      throw createAppError('VALIDATION_ERROR', 'Güncellenecek alan gönderilmedi');
    }
    updates.updated_at = db.fn.now();

    const [updated] = await db('playlist_views')
      .where('id', viewId)
      .update(updates)
      .returning('*');
    return updated;
  }

  async remove(userId, viewId) {
    await this._verifyViewOwnership(userId, viewId);
    await db('playlist_views').where('id', viewId).delete();
    return { success: true };
  }

  /**
   * Export entegrasyonu: gorunumun gizli kategori listesini dondurur.
   * Gorunum, verilen playlist'e ve kullaniciya ait degilse NOT_FOUND.
   */
  async getHiddenCategoryIds(userId, playlistId, viewId) {
    await this._verifyPlaylistOwnership(userId, playlistId);
    const view = await db('playlist_views')
      .where({ id: viewId, playlist_id: playlistId })
      .first();
    if (!view) {
      throw createAppError('NOT_FOUND');
    }
    return Array.isArray(view.hidden_category_ids) ? view.hidden_category_ids : [];
  }
}

module.exports = new ViewService();
