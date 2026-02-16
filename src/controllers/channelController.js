const channelService = require('../services/ChannelService');
const { createAppError } = require('../utils/AppError');

/**
 * GET /api/playlists/:id/channels
 */
async function listChannels(req, res, next) {
  try {
    const { id: playlistId } = req.params;
    const { page, limit, search, categoryId } = req.query;

    const options = {};
    if (page !== undefined) options.page = parseInt(page, 10);
    if (limit !== undefined) options.limit = parseInt(limit, 10);
    if (search) options.search = search;
    if (categoryId) options.categoryId = categoryId;

    const result = await channelService.list(req.userId, playlistId, options);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/channels/:id
 */
async function updateChannel(req, res, next) {
  try {
    const { id: channelId } = req.params;
    const updates = req.body;

    const channel = await channelService.update(req.userId, channelId, updates);
    res.json(channel);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/channels/:id
 */
async function deleteChannel(req, res, next) {
  try {
    const { id: channelId } = req.params;

    await channelService.delete(req.userId, channelId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/channels/:id/order
 */
async function updateChannelOrder(req, res, next) {
  try {
    const { id: channelId } = req.params;
    const { newPosition } = req.body;

    if (newPosition === undefined || typeof newPosition !== 'number' || newPosition < 0) {
      throw createAppError('VALIDATION_ERROR', 'newPosition sayısal ve 0 veya daha büyük olmalıdır');
    }

    await channelService.updateOrder(req.userId, channelId, newPosition);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/channels/bulk
 */
async function bulkAction(req, res, next) {
  try {
    const { action, channelIds, updates, targetCategoryId } = req.body;

    if (!action || !['update', 'move'].includes(action)) {
      throw createAppError('VALIDATION_ERROR', 'action "update" veya "move" olmalıdır');
    }

    if (!Array.isArray(channelIds) || channelIds.length === 0) {
      throw createAppError('VALIDATION_ERROR', 'channelIds boş olmayan bir dizi olmalıdır');
    }

    let result;
    if (action === 'update') {
      result = await channelService.bulkUpdate(req.userId, channelIds, updates || {});
    } else {
      result = await channelService.bulkMove(req.userId, channelIds, targetCategoryId);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { listChannels, updateChannel, deleteChannel, updateChannelOrder, bulkAction };
