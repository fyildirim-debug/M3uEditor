const db = require('../config/database');
const { createAppError } = require('../utils/AppError');

const PLAN_LIMITS = {
  free: { maxPlaylists: 3, maxChannelsPerPlaylist: 500 },
  pro: { maxPlaylists: 10, maxChannelsPerPlaylist: 5000 },
  business: { maxPlaylists: 999999, maxChannelsPerPlaylist: 999999 },
};

class PlanService {
  async checkPlaylistLimit(userId) {
    const user = await db('users').where({ id: userId }).first();
    if (!user) throw createAppError('NOT_FOUND');

    const limits = PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;
    const maxAllowed = user.max_playlists || limits.maxPlaylists;

    const { count } = await db('playlists').where({ user_id: userId }).count('id as count').first();
    const current = parseInt(count, 10);

    if (current >= maxAllowed) {
      throw createAppError('FORBIDDEN', `Playlist limitinize ulastiniz (${maxAllowed}). Planunuzu yukseltin.`);
    }

    return { current, max: maxAllowed, plan: user.plan };
  }

  async checkChannelLimit(userId, playlistId) {
    const user = await db('users').where({ id: userId }).first();
    if (!user) throw createAppError('NOT_FOUND');

    const limits = PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;
    const maxAllowed = user.max_channels_per_playlist || limits.maxChannelsPerPlaylist;

    const { count } = await db('channels').where({ playlist_id: playlistId }).count('id as count').first();
    const current = parseInt(count, 10);

    return { current, max: maxAllowed, plan: user.plan, limitReached: current >= maxAllowed };
  }

  async getUserPlan(userId) {
    const user = await db('users').where({ id: userId }).select('plan', 'max_playlists', 'max_channels_per_playlist', 'plan_expires_at').first();
    if (!user) throw createAppError('NOT_FOUND');

    const limits = PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;
    return {
      plan: user.plan || 'free',
      maxPlaylists: user.max_playlists || limits.maxPlaylists,
      maxChannelsPerPlaylist: user.max_channels_per_playlist || limits.maxChannelsPerPlaylist,
      expiresAt: user.plan_expires_at,
    };
  }
}

module.exports = new PlanService();
