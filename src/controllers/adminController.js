const db = require('../config/database');
const { createAppError } = require('../utils/AppError');

async function getStats(req, res, next) {
  try {
    const [userCount] = await db('users').count('id as count');
    const [playlistCount] = await db('playlists').count('id as count');
    const [channelCount] = await db('channels').count('id as count');

    const planDistribution = await db('users')
      .select('plan')
      .count('id as count')
      .groupBy('plan');

    const newUsersWeek = await db('users')
      .where('created_at', '>=', db.raw("NOW() - INTERVAL '7 days'"))
      .count('id as count');

    res.json({
      users: parseInt(userCount.count, 10),
      playlists: parseInt(playlistCount.count, 10),
      channels: parseInt(channelCount.count, 10),
      planDistribution: planDistribution.map(p => ({ plan: p.plan || 'free', count: parseInt(p.count, 10) })),
      newUsersThisWeek: parseInt(newUsersWeek[0].count, 10),
    });
  } catch (err) { next(err); }
}

async function listUsers(req, res, next) {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    let query = db('users')
      .select('users.id', 'users.email', 'users.plan', 'users.is_admin', 'users.created_at', 'users.max_playlists', 'users.max_channels_per_playlist', 'users.email_verified_at', 'users.plan_expires_at')
      .leftJoin(db.raw('(SELECT user_id, COUNT(*) as playlist_count FROM playlists GROUP BY user_id) as pc ON pc.user_id = users.id'))
      .select('pc.playlist_count');

    if (search) {
      query = query.where('users.email', 'ilike', `%${search}%`);
    }

    const countQuery = query.clone().clearSelect().count('users.id as count').clearOrder().first();
    const { count } = await countQuery;

    const users = await query
      .orderBy('users.created_at', 'desc')
      .limit(parseInt(limit, 10))
      .offset(offset);

    res.json({
      users: users.map(u => ({ ...u, playlist_count: parseInt(u.playlist_count || 0, 10) })),
      total: parseInt(count, 10),
      page: parseInt(page, 10),
      totalPages: Math.ceil(parseInt(count, 10) / parseInt(limit, 10)),
    });
  } catch (err) { next(err); }
}

async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const { plan, max_playlists, max_channels_per_playlist, is_admin, plan_expires_at } = req.body;

    const user = await db('users').where({ id }).first();
    if (!user) throw createAppError('NOT_FOUND', 'Kullanici bulunamadi');

    const updates = {};
    if (plan !== undefined) updates.plan = plan;
    if (max_playlists !== undefined) updates.max_playlists = max_playlists;
    if (max_channels_per_playlist !== undefined) updates.max_channels_per_playlist = max_channels_per_playlist;
    if (is_admin !== undefined) updates.is_admin = is_admin;
    if (plan_expires_at !== undefined) updates.plan_expires_at = plan_expires_at;

    if (Object.keys(updates).length > 0) {
      await db('users').where({ id }).update(updates);
    }

    const updated = await db('users').where({ id }).select('id', 'email', 'plan', 'is_admin', 'max_playlists', 'max_channels_per_playlist', 'plan_expires_at', 'created_at').first();
    res.json(updated);
  } catch (err) { next(err); }
}

async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;
    const user = await db('users').where({ id }).first();
    if (!user) throw createAppError('NOT_FOUND', 'Kullanici bulunamadi');
    if (user.is_admin) throw createAppError('FORBIDDEN', 'Admin kullanici silinemez');

    await db('users').where({ id }).del();
    res.json({ success: true });
  } catch (err) { next(err); }
}

module.exports = { getStats, listUsers, updateUser, deleteUser };
