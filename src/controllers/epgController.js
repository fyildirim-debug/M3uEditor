const EPGService = require('../services/EPGService');
const db = require('../config/database');
const logger = require('../config/logger');
const { createAppError } = require('../utils/AppError');

const epgService = new EPGService();

async function addSource(req, res, next) {
  try {
    const { url, async: asyncMode } = req.body || {};
    const source = await epgService.addSource(req.userId, url);
    if (asyncMode) {
      epgService.parseAndStore(source.id).catch((error) => logger.warn({ err: error, sourceId: source.id }, 'Async EPG import failed'));
      return res.status(202).json({ source, channelCount: 0, programCount: 0 });
    }
    const result = await epgService.parseAndStore(source.id);
    const [updated] = await epgService.listSources(req.userId).then((sources) => sources.filter((item) => item.id === source.id));
    return res.status(201).json({ source: updated, ...result });
  } catch (error) { return next(error); }
}

async function listSources(req, res, next) {
  try { res.json(await epgService.listSources(req.userId)); } catch (error) { next(error); }
}

async function autoMatch(req, res, next) {
  try { res.json(await epgService.autoMatch(req.userId, req.params.id)); } catch (error) { next(error); }
}

async function getPreview(req, res, next) {
  try {
    res.json(await epgService.getPreview(req.userId, req.params.id, req.query.date, req.query.tzOffset));
  } catch (error) { next(error); }
}

async function assignEpg(req, res, next) {
  try {
    const channelId = req.params.id;
    const { epgChannelId, epgSourceId } = req.body || {};
    if (epgChannelId !== null && (typeof epgChannelId !== 'string' || !epgChannelId.trim())) {
      throw createAppError('VALIDATION_ERROR', 'EPG kanal kimliği metin veya null olmalı');
    }
    const channel = await db('channels')
      .join('playlists', 'channels.playlist_id', 'playlists.id')
      .where({ 'channels.id': channelId, 'playlists.user_id': req.userId })
      .select('channels.id')
      .first();
    if (!channel) throw createAppError('NOT_FOUND', 'Kanal bulunamadı');

    let sourceId = null;
    if (epgChannelId) {
      let query = db('epg_channels')
        .join('epg_sources', 'epg_channels.source_id', 'epg_sources.id')
        .where({ 'epg_channels.channel_id': epgChannelId.trim(), 'epg_sources.user_id': req.userId });
      if (epgSourceId) query = query.andWhere('epg_channels.source_id', epgSourceId);
      const matches = await query.select('epg_channels.source_id').limit(2);
      if (!matches.length) throw createAppError('VALIDATION_ERROR', 'EPG kanalı hesabınıza ait değil');
      if (matches.length > 1 && !epgSourceId) throw createAppError('VALIDATION_ERROR', 'Aynı kimlik birden fazla kaynakta var; kaynak seçin');
      sourceId = matches[0].source_id;
    }
    const [updated] = await db('channels').where({ id: channelId }).update({
      epg_channel_id: epgChannelId ? epgChannelId.trim() : null,
      epg_source_id: sourceId,
      updated_at: db.fn.now(),
    }).returning('*');
    res.json(updated);
  } catch (error) { next(error); }
}

async function deleteSource(req, res, next) {
  try { await epgService.deleteSource(req.userId, req.params.id); res.json({ success: true }); } catch (error) { next(error); }
}

async function refreshSource(req, res, next) {
  try { res.json(await epgService.refreshSource(req.userId, req.params.id)); } catch (error) { next(error); }
}

async function getGuide(req, res, next) {
  try { res.json(await epgService.getGuide(req.userId, req.params.id, req.query.date, req.query.tzOffset)); } catch (error) { next(error); }
}

async function searchEpgChannels(req, res, next) {
  try { res.json(await epgService.searchEpgChannels(req.userId, req.query.q, req.query.limit)); } catch (error) { next(error); }
}

module.exports = { addSource, listSources, autoMatch, getPreview, assignEpg, deleteSource, refreshSource, getGuide, searchEpgChannels };
