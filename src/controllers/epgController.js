const EPGService = require('../services/EPGService');
const db = require('../config/database');
const { createAppError } = require('../utils/AppError');

const epgService = new EPGService();

/**
 * POST /api/epg/sources
 * Add a new EPG source URL, then fetch and parse it.
 */
async function addSource(req, res, next) {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      throw createAppError('VALIDATION_ERROR', 'url alanı zorunludur');
    }

    const source = await epgService.addSource(req.userId, url.trim());
    const parseResult = await epgService.parseAndStore(source.id);

    res.status(201).json({
      source,
      channelCount: parseResult.channelCount,
      programCount: parseResult.programCount,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/epg/sources
 * List all EPG sources for the authenticated user.
 */
async function listSources(req, res, next) {
  try {
    const sources = await db('epg_sources')
      .where({ user_id: req.userId })
      .orderBy('created_at', 'desc');

    res.json(sources);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/playlists/:id/epg/auto-match
 * Auto-match playlist channels with EPG channels.
 */
async function autoMatch(req, res, next) {
  try {
    const { id: playlistId } = req.params;
    const matches = await epgService.autoMatch(req.userId, playlistId);
    res.json(matches);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/channels/:id/epg/preview
 * Get EPG program preview for a channel.
 */
async function getPreview(req, res, next) {
  try {
    const { id: channelId } = req.params;
    const { date } = req.query;
    const programs = await epgService.getPreview(channelId, date || undefined);
    res.json(programs);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/channels/:id/epg
 * Assign an EPG channel ID to a channel.
 */
async function assignEpg(req, res, next) {
  try {
    const { id: channelId } = req.params;
    const { epgChannelId } = req.body;

    if (epgChannelId !== null && (typeof epgChannelId !== 'string' || epgChannelId.trim().length === 0)) {
      throw createAppError('VALIDATION_ERROR', 'epgChannelId bir string olmalıdır veya null olabilir');
    }

    // Verify channel belongs to user
    const channel = await db('channels')
      .join('playlists', 'channels.playlist_id', 'playlists.id')
      .where({ 'channels.id': channelId, 'playlists.user_id': req.userId })
      .select('channels.id')
      .first();

    if (!channel) {
      throw createAppError('NOT_FOUND', 'Kanal bulunamadı');
    }

    const [updated] = await db('channels')
      .where({ id: channelId })
      .update({ epg_channel_id: epgChannelId, updated_at: new Date() })
      .returning('*');

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = { addSource, listSources, autoMatch, getPreview, assignEpg };
