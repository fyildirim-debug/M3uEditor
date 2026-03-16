const fs = require('fs').promises;
const path = require('path');
const db = require('../config/database');
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

/**
 * POST /api/channels/:id/metadata
 * Fetch metadata from Xtream get_vod_info / get_series_info and update channel extras.
 */
async function fetchMetadata(req, res, next) {
  try {
    const { id: channelId } = req.params;
    const force = req.query.force === 'true';

    const channel = await channelService._verifyChannelOwnership(req.userId, channelId);
    const extras = channel.extras || {};

    if (extras.metadata_fetched && !force) {
      return res.json(channel);
    }

    if (channel.stream_type !== 'vod' && channel.stream_type !== 'series') {
      throw createAppError('VALIDATION_ERROR', 'Metadata sadece film ve dizi icin cekilebilir');
    }

    // Playlist'ten Xtream credentials al
    const playlist = await db('playlists').where('id', channel.playlist_id).first();
    if (!playlist?.xtream_server_url || !playlist?.xtream_username || !playlist?.xtream_password_enc) {
      throw createAppError('VALIDATION_ERROR', 'Xtream Codes kaynagi bulunamadi');
    }

    const XtreamClient = require('../services/XtreamClient');
    const client = new XtreamClient(playlist.xtream_server_url, playlist.xtream_username, playlist.xtream_password_enc);

    let info;
    if (channel.stream_type === 'vod') {
      info = await client.getVodInfo(extras.stream_id);
    } else {
      info = await client.getSeriesInfo(extras.stream_id);
    }

    if (!info) {
      throw createAppError('NOT_FOUND', 'Xtream API\'den bilgi alinamadi');
    }

    // VOD info normalize
    const movieInfo = info.info || info.movie_data || info;
    const metadata = {
      metadata_fetched: true,
      tmdb_id: movieInfo.tmdb_id || movieInfo.tmdb || extras.tmdb_id || null,
      imdb_id: movieInfo.imdb_id || null,
      title: movieInfo.name || movieInfo.title || movieInfo.o_name || null,
      overview: movieInfo.plot || movieInfo.description || movieInfo.overview || null,
      year: movieInfo.year || movieInfo.releaseDate?.slice(0, 4) || movieInfo.releasedate?.slice(0, 4) || extras.year || null,
      rating: movieInfo.rating || movieInfo.rating_5based ? String(parseFloat(movieInfo.rating_5based || 0) * 2) : extras.rating || null,
      genre: movieInfo.genre || movieInfo.category_name || extras.genre || null,
      cast: movieInfo.cast || movieInfo.actors || null,
      director: movieInfo.director || null,
      runtime: movieInfo.duration || movieInfo.runtime || movieInfo.episode_run_time || null,
      backdrop_url: movieInfo.backdrop_path?.[0] || movieInfo.cover_big || movieInfo.cover || null,
      poster_url: movieInfo.movie_image || movieInfo.cover || channel.logo_url || null,
    };

    // Series ek bilgiler
    if (channel.stream_type === 'series') {
      const seasons = info.seasons || info.episodes;
      if (seasons) {
        metadata.seasons = Object.keys(seasons).length || null;
        let totalEp = 0;
        for (const s of Object.values(seasons)) {
          totalEp += Array.isArray(s) ? s.length : 0;
        }
        metadata.episodes = totalEp || null;
      }
    }

    const updatedExtras = { ...extras, ...metadata };
    await db('channels').where('id', channelId).update({
      extras: JSON.stringify(updatedExtras),
      updated_at: db.fn.now(),
    });

    const updated = await db('channels').where('id', channelId).first();
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = { listChannels, updateChannel, deleteChannel, updateChannelOrder, bulkAction, resetChannel, uploadLogo, fetchMetadata };
