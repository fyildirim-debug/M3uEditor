const fs = require('fs').promises;
const path = require('path');
const channelService = require('../services/ChannelService');
const { createAppError } = require('../utils/AppError');

/**
 * GET /api/playlists/:id/channels
 */
async function listChannels(req, res, next) {
  try {
    const { id: playlistId } = req.params;
    const { page, limit, search, categoryId, streamType } = req.query;

    const options = {};
    if (page !== undefined) options.page = parseInt(page, 10);
    if (limit !== undefined) options.limit = parseInt(limit, 10);
    if (search) options.search = search;
    if (categoryId) options.categoryId = categoryId;
    if (streamType) options.streamType = streamType;

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

/**
 * POST /api/channels/:id/reset
 * Reset channel to original Xtream values (name + logo).
 */
async function resetChannel(req, res, next) {
  try {
    const { id: channelId } = req.params;
    const channel = await channelService.reset(req.userId, channelId);
    res.json(channel);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/channels/:id/logo
 * Upload a custom logo image (base64) and update channel logo_url.
 * body: { imageData: "data:image/png;base64,..." }
 */
async function uploadLogo(req, res, next) {
  try {
    const { id: channelId } = req.params;
    const { imageData } = req.body;

    if (!imageData || typeof imageData !== 'string') {
      throw createAppError('VALIDATION_ERROR', 'imageData zorunludur');
    }

    const match = imageData.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
    if (!match) {
      throw createAppError('VALIDATION_ERROR', 'Geçersiz resim formatı');
    }

    const ext = match[1].replace('+', '').toLowerCase();
    const allowed = ['png', 'jpeg', 'jpg', 'gif', 'webp', 'svg', 'svgxml'];
    if (!allowed.includes(ext)) {
      throw createAppError('VALIDATION_ERROR', 'Desteklenmeyen resim formatı');
    }

    const imageBuffer = Buffer.from(match[2], 'base64');
    if (imageBuffer.length > 2 * 1024 * 1024) {
      throw createAppError('VALIDATION_ERROR', 'Resim 2MB\'dan büyük olamaz');
    }

    const logosDir = path.join(__dirname, '../../public/logos');
    await fs.mkdir(logosDir, { recursive: true });

    const filename = `${channelId}.${ext === 'jpeg' ? 'jpg' : ext}`;
    await fs.writeFile(path.join(logosDir, filename), imageBuffer);

    const logoUrl = `/logos/${filename}`;
    const channel = await channelService.update(req.userId, channelId, { logo_url: logoUrl });
    res.json(channel);
  } catch (err) {
    next(err);
  }
}

module.exports = { listChannels, updateChannel, deleteChannel, updateChannelOrder, bulkAction, resetChannel, uploadLogo };
