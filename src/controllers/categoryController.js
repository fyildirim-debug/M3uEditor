const categoryService = require('../services/CategoryService');
const { createAppError } = require('../utils/AppError');

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

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
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

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
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
    const { newPosition } = req.body;

    if (newPosition === undefined || typeof newPosition !== 'number' || newPosition < 0) {
      throw createAppError('VALIDATION_ERROR', 'newPosition sayısal ve 0 veya daha büyük olmalıdır');
    }

    await categoryService.updateOrder(req.userId, categoryId, newPosition);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listCategories, createCategory, updateCategory, deleteCategory, updateCategoryOrder };
