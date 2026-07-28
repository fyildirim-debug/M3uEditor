const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const config = require('../config');
const channelService = require('../services/ChannelService');
const XtreamClient = require('../services/XtreamClient');
const { createAppError } = require('../utils/AppError');
const { decrypt } = require('../utils/crypto');
const { requestBuffer } = require('../utils/safeFetch');
const { parsePagination, validateIdArray } = require('../utils/validation');

async function listChannels(req, res, next) {
  try {
    const { page, limit, search, categoryId, streamType } = req.query;
    const options = { ...parsePagination(page, limit), search, categoryId, streamType };
    res.json(await channelService.list(req.userId, req.params.id, options));
  } catch (error) { next(error); }
}

async function updateChannel(req, res, next) {
  try { res.json(await channelService.update(req.userId, req.params.id, req.body)); } catch (error) { next(error); }
}

async function deleteChannel(req, res, next) {
  try {
    await channelService.delete(req.userId, req.params.id);
    res.status(204).end();
  } catch (error) { next(error); }
}

async function updateChannelOrder(req, res, next) {
  try {
    const { newPosition } = req.body;
    if (!Number.isInteger(newPosition) || newPosition < 0) {
      throw createAppError('VALIDATION_ERROR', 'Yeni sıra sıfır veya daha büyük bir tam sayı olmalı');
    }
    await channelService.updateOrder(req.userId, req.params.id, newPosition);
    res.json({ success: true });
  } catch (error) { next(error); }
}

async function bulkAction(req, res, next) {
  try {
    const { action, channelIds, updates, targetCategoryId } = req.body;
    if (!['update', 'move', 'delete'].includes(action)) {
      throw createAppError('VALIDATION_ERROR', 'Desteklenmeyen toplu işlem');
    }
    const uniqueIds = validateIdArray(channelIds);
    let result;
    if (action === 'update') result = await channelService.bulkUpdate(req.userId, uniqueIds, updates || {});
    if (action === 'move') {
      if (!targetCategoryId) throw createAppError('VALIDATION_ERROR', 'Hedef kategori gerekli');
      result = await channelService.bulkMove(req.userId, uniqueIds, targetCategoryId);
    }
    if (action === 'delete') result = await channelService.bulkDelete(req.userId, uniqueIds);
    res.json(result);
  } catch (error) { next(error); }
}

async function resetChannel(req, res, next) {
  try { res.json(await channelService.reset(req.userId, req.params.id)); } catch (error) { next(error); }
}

function detectImageExtension(buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) return 'gif';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

async function uploadLogo(req, res, next) {
  try {
    const { imageData } = req.body;
    if (typeof imageData !== 'string' || imageData.length > 3 * 1024 * 1024) {
      throw createAppError('VALIDATION_ERROR', 'En fazla 2 MB boyutunda bir resim gönderin');
    }
    const match = imageData.match(/^data:image\/(png|jpe?g|gif|webp);base64,([A-Za-z0-9+/=]+)$/i);
    if (!match) throw createAppError('VALIDATION_ERROR', 'PNG, JPEG, GIF veya WebP resmi gerekli');

    const imageBuffer = Buffer.from(match[2], 'base64');
    if (!imageBuffer.length || imageBuffer.length > 2 * 1024 * 1024) {
      throw createAppError('VALIDATION_ERROR', 'Resim 2 MB’den büyük olamaz');
    }
    const detectedExt = detectImageExtension(imageBuffer);
    if (!detectedExt || match[1].toLowerCase().replace('jpeg', 'jpg') !== detectedExt) {
      throw createAppError('VALIDATION_ERROR', 'Dosya içeriği bildirilen resim türüyle eşleşmiyor');
    }

    const channelId = req.params.id;
    await channelService._verifyChannelOwnership(req.userId, channelId);
    await fs.mkdir(config.uploadDir, { recursive: true });
    const filename = `${channelId}.${detectedExt}`;
    await fs.writeFile(path.join(config.uploadDir, filename), imageBuffer, { flag: 'w', mode: 0o640 });
    await Promise.all(['png', 'jpg', 'gif', 'webp']
      .filter((extension) => extension !== detectedExt)
      .map((extension) => fs.unlink(path.join(config.uploadDir, `${channelId}.${extension}`)).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      })));
    res.json(await channelService.update(req.userId, channelId, { logo_url: `/logos/${filename}` }));
  } catch (error) { next(error); }
}

async function fetchMetadata(req, res, next) {
  try {
    const channelId = req.params.id;
    const force = req.query.force === 'true';
    const channel = await channelService._verifyChannelOwnership(req.userId, channelId);
    const extras = typeof channel.extras === 'string' ? JSON.parse(channel.extras) : (channel.extras || {});
    if (extras.metadata_fetched && !force) return res.json(channel);
    if (!['vod', 'series'].includes(channel.stream_type)) {
      throw createAppError('VALIDATION_ERROR', 'Metadata yalnızca film ve dizi için alınabilir');
    }

    const playlist = await db('playlists').where({ id: channel.playlist_id, user_id: req.userId }).first();
    if (!playlist?.xtream_server_url || !playlist?.xtream_username || !playlist?.xtream_password_enc) {
      throw createAppError('VALIDATION_ERROR', 'Xtream kaynağı bulunamadı');
    }
    const client = new XtreamClient(playlist.xtream_server_url, playlist.xtream_username, decrypt(playlist.xtream_password_enc));
    const info = channel.stream_type === 'vod'
      ? await client.getVodInfo(extras.stream_id)
      : await client.getSeriesInfo(extras.stream_id);
    if (!info) throw createAppError('NOT_FOUND', 'Sağlayıcıdan metadata alınamadı');

    const movieInfo = info.info || info.movie_data || info;
    const metadata = {
      metadata_fetched: true,
      tmdb_id: movieInfo.tmdb_id || movieInfo.tmdb || extras.tmdb_id || null,
      imdb_id: movieInfo.imdb_id || null,
      title: movieInfo.name || movieInfo.title || movieInfo.o_name || null,
      overview: movieInfo.plot || movieInfo.description || movieInfo.overview || null,
      year: movieInfo.year || movieInfo.releaseDate?.slice(0, 4) || movieInfo.releasedate?.slice(0, 4) || extras.year || null,
      rating: movieInfo.rating || (movieInfo.rating_5based ? String(Number.parseFloat(movieInfo.rating_5based) * 2) : extras.rating || null),
      genre: movieInfo.genre || movieInfo.category_name || extras.genre || null,
      cast: movieInfo.cast || movieInfo.actors || null,
      director: movieInfo.director || null,
      runtime: movieInfo.duration || movieInfo.runtime || movieInfo.episode_run_time || null,
      backdrop_url: movieInfo.backdrop_path?.[0] || movieInfo.cover_big || movieInfo.cover || null,
      poster_url: movieInfo.movie_image || movieInfo.cover || channel.logo_url || null,
    };
    if (channel.stream_type === 'series') {
      const seasons = info.seasons || info.episodes;
      if (seasons) {
        metadata.seasons = Object.keys(seasons).length || null;
        metadata.episodes = Object.values(seasons).reduce((total, season) => total + (Array.isArray(season) ? season.length : 0), 0) || null;
      }
    }

    await db('channels').where({ id: channelId }).update({ extras: JSON.stringify({ ...extras, ...metadata }), updated_at: db.fn.now() });
    res.json(await db('channels').where({ id: channelId }).first());
  } catch (error) { next(error); }
}

async function bulkRename(req, res, next) {
  try {
    const { channelIds, find, replace, useRegex } = req.body;
    const uniqueIds = validateIdArray(channelIds);
    if (typeof find !== 'string' || !find.length) throw createAppError('VALIDATION_ERROR', 'Aranacak metin gerekli');
    res.json(await channelService.bulkRename(req.userId, uniqueIds, find, String(replace || ''), Boolean(useRegex)));
  } catch (error) { next(error); }
}

async function testStream(req, res, next) {
  try {
    const channel = await channelService._verifyChannelOwnership(req.userId, req.params.id);
    if (!channel.stream_url) return res.json({ reachable: false, error: 'Akış adresi boş' });
    try {
      const response = await requestBuffer(channel.stream_url, { method: 'HEAD', timeoutMs: 10_000, maxBytes: 1024 });
      res.json({ reachable: true, status: response.status, contentType: response.headers['content-type'] || null });
    } catch (error) {
      res.json({ reachable: false, error: error.message });
    }
  } catch (error) { next(error); }
}

async function createChannel(req, res, next) {
  try {
    const playlistId = req.params.id;
    const { name, streamUrl, logoUrl, categoryId, epgChannelId, streamType } = req.body;
    if (typeof name !== 'string' || !name.trim() || name.length > 500 || typeof streamUrl !== 'string' || !streamUrl.trim() || streamUrl.length > 5000) {
      throw createAppError('VALIDATION_ERROR', 'Geçerli kanal adı ve akış adresi gerekli');
    }
    const playlist = await db('playlists').where({ id: playlistId, user_id: req.userId }).first();
    if (!playlist) throw createAppError('NOT_FOUND');
    await channelService._verifyCategoryForPlaylist(req.userId, playlistId, categoryId || null);

    let epgSourceId = null;
    if (epgChannelId) {
      const epgChannel = await db('epg_channels')
        .join('epg_sources', 'epg_channels.source_id', 'epg_sources.id')
        .where({ 'epg_channels.channel_id': epgChannelId, 'epg_sources.user_id': req.userId })
        .select('epg_channels.source_id')
        .first();
      if (!epgChannel) throw createAppError('VALIDATION_ERROR', 'EPG kanalı hesabınıza ait değil');
      epgSourceId = epgChannel.source_id;
    }

    const maxSort = await db('channels').where({ playlist_id: playlistId }).max('sort_order as max').first();
    const [channel] = await db('channels').insert({
      id: uuidv4(),
      playlist_id: playlistId,
      name: name.trim(),
      original_name: name.trim(),
      stream_url: streamUrl.trim(),
      logo_url: logoUrl || null,
      original_logo_url: logoUrl || null,
      category_id: categoryId || null,
      epg_channel_id: epgChannelId || null,
      epg_source_id: epgSourceId,
      stream_type: ['live', 'vod', 'series'].includes(streamType) ? streamType : 'live',
      sort_order: (maxSort?.max ?? -1) + 1,
      extras: JSON.stringify({}),
    }).returning('*');
    res.status(201).json(channel);
  } catch (error) { next(error); }
}

module.exports = { listChannels, updateChannel, deleteChannel, updateChannelOrder, bulkAction, resetChannel, uploadLogo, fetchMetadata, bulkRename, testStream, createChannel };
