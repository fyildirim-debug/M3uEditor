const viewService = require('../services/ViewService');
const { createAppError } = require('../utils/AppError');
const { validate: validateUuid } = require('uuid');

/**
 * GET /api/playlists/:id/views
 */
async function listViews(req, res, next) {
  try {
    const { id: playlistId } = req.params;
    if (!validateUuid(playlistId)) {
      throw createAppError('VALIDATION_ERROR', 'Geçersiz playlist kimliği');
    }
    const views = await viewService.list(req.userId, playlistId);
    res.json(views);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/playlists/:id/views
 */
async function createView(req, res, next) {
  try {
    const { id: playlistId } = req.params;
    if (!validateUuid(playlistId)) {
      throw createAppError('VALIDATION_ERROR', 'Geçersiz playlist kimliği');
    }
    const { name, hiddenCategoryIds } = req.body || {};
    const view = await viewService.create(req.userId, playlistId, { name, hiddenCategoryIds });
    res.status(201).json(view);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/views/:id
 */
async function updateView(req, res, next) {
  try {
    const { id: viewId } = req.params;
    if (!validateUuid(viewId)) {
      throw createAppError('VALIDATION_ERROR', 'Geçersiz görünüm kimliği');
    }
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw createAppError('VALIDATION_ERROR', 'Geçersiz istek gövdesi');
    }
    const view = await viewService.update(req.userId, viewId, {
      name: body.name,
      hiddenCategoryIds: body.hiddenCategoryIds,
    });
    res.json(view);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/views/:id
 */
async function deleteView(req, res, next) {
  try {
    const { id: viewId } = req.params;
    if (!validateUuid(viewId)) {
      throw createAppError('VALIDATION_ERROR', 'Geçersiz görünüm kimliği');
    }
    res.json(await viewService.remove(req.userId, viewId));
  } catch (err) {
    next(err);
  }
}

module.exports = { listViews, createView, updateView, deleteView };
