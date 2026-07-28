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
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 500) {
      throw createAppError('VALIDATION_ERROR', 'name alanı zorunludur ve boş olamaz');
    }

    const category = await categoryService.update(req.userId, categoryId, name.trim());
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
