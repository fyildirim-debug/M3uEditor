const categoryService = require('../services/CategoryService');
const { createAppError } = require('../utils/AppError');
const { validate: validateUuid } = require('uuid');

/**
 * GET /api/playlists/:id/categories
 */
async function listCategories(req, res, next) {
  try {
    const { id: playlistId } = req.params;
    const { streamType } = req.query;
    const categories = await categoryService.list(req.userId, playlistId, streamType);
    res.json(categories);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/playlists/:id/categories
 */
async function createCategory(req, res, next) {
  try {
    const { id: playlistId } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 500) {
      throw createAppError('VALIDATION_ERROR', 'name alanı zorunludur ve boş olamaz');
    }

    const category = await categoryService.create(req.userId, playlistId, name.trim());
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/categories/:id
 */
async function updateCategory(req, res, next) {
  try {
    const { id: categoryId } = req.params;
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw createAppError('VALIDATION_ERROR', 'Geçerli bir istek gövdesi gönderin');
    }

    const hasName = Object.prototype.hasOwnProperty.call(body, 'name');
    const hasIsHidden = Object.prototype.hasOwnProperty.call(body, 'is_hidden');
    if (!hasName && !hasIsHidden) {
      throw createAppError('VALIDATION_ERROR', 'name veya is_hidden alanlarından biri zorunludur');
    }

    const updates = {};
    if (hasName) {
      if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0 || body.name.length > 500) {
        throw createAppError('VALIDATION_ERROR', 'name alanı boş olamaz');
      }
      updates.name = body.name.trim();
    }
    if (hasIsHidden) {
      if (typeof body.is_hidden !== 'boolean') {
        throw createAppError('VALIDATION_ERROR', 'is_hidden alanı boolean olmalıdır');
      }
      updates.is_hidden = body.is_hidden;
    }

    const category = await categoryService.update(req.userId, categoryId, updates);
    res.json(category);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/categories/:id
 */
async function deleteCategory(req, res, next) {
  try {
    const { id: categoryId } = req.params;
    await categoryService.delete(req.userId, categoryId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/categories/:id/order
 */
async function updateCategoryOrder(req, res, next) {
  try {
    const { id: categoryId } = req.params;
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      throw createAppError('VALIDATION_ERROR', 'Geçerli bir istek gövdesi gönderin');
    }
    if (!validateUuid(categoryId)) {
      throw createAppError('VALIDATION_ERROR', 'Geçerli bir kategori kimliği gönderin');
    }
    const { afterCategoryId, beforeCategoryId } = req.body;
    const hasAfter = afterCategoryId !== undefined;
    const hasBefore = beforeCategoryId !== undefined;
    if (hasAfter === hasBefore) {
      throw createAppError('VALIDATION_ERROR', 'afterCategoryId veya beforeCategoryId alanlarından yalnızca biri gönderilmelidir');
    }
    const referenceCategoryId = hasAfter ? afterCategoryId : beforeCategoryId;
    if (typeof referenceCategoryId !== 'string' || !validateUuid(referenceCategoryId)) {
      throw createAppError('VALIDATION_ERROR', 'Geçerli bir referans kategori kimliği gönderin');
    }

    const relativePosition = hasAfter ? { afterCategoryId } : { beforeCategoryId };
    await categoryService.updateOrder(req.userId, categoryId, relativePosition);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listCategories, createCategory, updateCategory, deleteCategory, updateCategoryOrder };
