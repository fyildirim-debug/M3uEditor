/**
 * Arac modullerinin paylastigi dogrulama ve sahiplik yardimcilari.
 *
 * Buradaki her fonksiyon `ctx.userId` uzerinden calisir. Asistanin yetkisi
 * kendi kullanicisinin yetkisidir: baska bir kullanicinin verisine erisen ya da
 * yonetici (admin) yetkisi gerektiren hicbir yol buradan gecmez.
 */

const db = require('../../config/database');
const { createAppError } = require('../../utils/AppError');

// Modele donen listelerin ust siniri: baglam penceresini korur.
const MAX_ROWS = 200;
const MAX_BULK_IDS = 5000;

function assertDestructive(ctx, action) {
  if (ctx.allowDestructive) return;
  throw createAppError('FORBIDDEN', `Silme/üzerine yazma izni kapalı olduğu için "${action}" çalıştırılamadı. Kullanıcıdan asistan ayarlarından izni açmasını isteyin.`);
}

async function ownedPlaylist(userId, playlistId) {
  if (typeof playlistId !== 'string' || !playlistId.trim()) {
    throw createAppError('VALIDATION_ERROR', 'playlistId gerekli');
  }
  const playlist = await db('playlists').where({ id: playlistId, user_id: userId }).first();
  if (!playlist) throw createAppError('NOT_FOUND', 'Oynatma listesi bulunamadı');
  return playlist;
}

async function ownedCategory(userId, categoryId) {
  const category = await db('categories')
    .join('playlists', 'categories.playlist_id', 'playlists.id')
    .where({ 'categories.id': categoryId, 'playlists.user_id': userId })
    .select('categories.*')
    .first();
  if (!category) throw createAppError('NOT_FOUND', 'Kategori bulunamadı');
  return category;
}

async function ownedChannel(userId, channelId) {
  const channel = await db('channels')
    .join('playlists', 'channels.playlist_id', 'playlists.id')
    .where({ 'channels.id': channelId, 'playlists.user_id': userId })
    .select('channels.*')
    .first();
  if (!channel) throw createAppError('NOT_FOUND', 'Kanal bulunamadı');
  return channel;
}

function idList(ids, max = MAX_BULK_IDS) {
  if (!Array.isArray(ids) || !ids.length) throw createAppError('VALIDATION_ERROR', 'En az bir kimlik gönderin');
  if (ids.length > max) throw createAppError('VALIDATION_ERROR', `En fazla ${max} kimlik gönderilebilir`);
  const cleaned = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
  if (!cleaned.length) throw createAppError('VALIDATION_ERROR', 'Geçerli kimlik bulunamadı');
  return cleaned;
}

function limitRows(value, fallback = 50) {
  return Math.min(Math.max(Number(value) || fallback, 1), MAX_ROWS);
}

function text(value, { field = 'değer', max = 500, required = true } = {}) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    if (required) throw createAppError('VALIDATION_ERROR', `${field} gerekli`);
    return null;
  }
  if (trimmed.length > max) throw createAppError('VALIDATION_ERROR', `${field} en fazla ${max} karakter olabilir`);
  return trimmed;
}

function compactChannel(channel) {
  return {
    id: channel.id,
    name: channel.name,
    streamType: channel.stream_type,
    categoryId: channel.category_id,
    categoryName: channel.category_name ?? undefined,
    hasLogo: Boolean(channel.logo_url),
    epgChannelId: channel.epg_channel_id || null,
  };
}

function compactCategory(category) {
  return {
    id: category.id,
    name: category.name,
    sortOrder: category.sort_order,
    hidden: category.is_hidden === true,
    channelCount: category.channel_count,
  };
}

/**
 * Kanal secimini tek bir yerde cozer: acik kimlik listesi ya da
 * playlist + arama/kategori/filtre kombinasyonu. Her iki yolda da yalnizca
 * cagiran kullanicinin kanallari donebilir.
 */
async function resolveChannelIds(ctx, args, { max = MAX_BULK_IDS } = {}) {
  if (Array.isArray(args.channelIds) && args.channelIds.length) {
    const ids = idList(args.channelIds, max);
    const owned = await db('channels')
      .join('playlists', 'channels.playlist_id', 'playlists.id')
      .whereIn('channels.id', ids)
      .andWhere('playlists.user_id', ctx.userId)
      .count('channels.id as count')
      .first();
    if (Number(owned.count) !== ids.length) throw createAppError('NOT_FOUND', 'Kanallardan biri hesabınıza ait değil');
    return ids;
  }

  const playlistId = args.playlistId || ctx.playlistId;
  await ownedPlaylist(ctx.userId, playlistId);

  const query = db('channels').where('playlist_id', playlistId);
  if (args.streamType) query.andWhere('stream_type', args.streamType);
  if (args.categoryId === null) query.whereNull('category_id');
  else if (args.categoryId) query.andWhere('category_id', args.categoryId);
  if (args.search) query.andWhereRaw('name ILIKE ?', [`%${args.search}%`]);
  if (args.nameRegex) query.andWhereRaw('name ~* ?', [String(args.nameRegex).slice(0, 200)]);
  if (args.filter === 'missing_logo') query.andWhere((builder) => builder.whereNull('logo_url').orWhere('logo_url', ''));
  if (args.filter === 'missing_epg') query.andWhere((builder) => builder.whereNull('epg_channel_id').orWhere('epg_channel_id', ''));
  if (args.filter === 'has_logo') query.andWhereNot('logo_url', '').whereNotNull('logo_url');
  if (args.filter === 'dead') query.andWhere('last_check_ok', false);
  if (args.filter === 'alive') query.andWhere('last_check_ok', true);
  if (args.filter === 'unchecked') query.whereNull('last_checked_at');

  const rows = await query.select('id').orderBy('sort_order', 'asc').limit(max + 1);
  if (rows.length > max) throw createAppError('VALIDATION_ERROR', `Seçim ${max} kanaldan fazlasını kapsıyor; daraltın`);
  if (!rows.length) throw createAppError('NOT_FOUND', 'Seçimle eşleşen kanal bulunamadı');
  return rows.map((row) => row.id);
}

/**
 * Alt kumeyi, kumenin halihazirda kapladigi sort_order yuvalarina yeniden
 * dagitir. Listenin geri kalani yerinde kalir, bu yuzden tur/kategori
 * filtreli siralama guvenlidir.
 */
async function reorderChannels(playlistId, scope, orderExpression) {
  const where = ['playlist_id = ?'];
  const params = [playlistId];
  if (scope.streamType) { where.push('stream_type = ?'); params.push(scope.streamType); }
  if (scope.categoryId) { where.push('category_id = ?'); params.push(scope.categoryId); }

  const result = await db.raw(
    `WITH scoped AS (
       SELECT c.id, c.sort_order, c.name, c.category_id, c.epg_channel_id, c.last_check_ok,
              cat.sort_order AS category_sort, cat.name AS category_name
         FROM channels c
         LEFT JOIN categories cat ON cat.id = c.category_id
        WHERE ${where.join(' AND ')}
     ),
     slots AS (
       SELECT sort_order, ROW_NUMBER() OVER (ORDER BY sort_order ASC, id ASC) AS rn FROM scoped
     ),
     ranked AS (
       SELECT id, ROW_NUMBER() OVER (ORDER BY ${orderExpression}) AS rn FROM scoped
     )
     UPDATE channels AS ch
        SET sort_order = slots.sort_order, updated_at = NOW()
       FROM ranked JOIN slots ON slots.rn = ranked.rn
      WHERE ch.id = ranked.id
        AND ch.sort_order IS DISTINCT FROM slots.sort_order
      RETURNING ch.id`,
    params
  );
  return result.rows.length;
}

/** Verilen kanallari, kapladiklari yuvalara istenen sirayla yerlestirir. */
async function applyExplicitOrder(playlistId, orderedIds) {
  const result = await db.raw(
    `WITH scoped AS (
       SELECT id, sort_order FROM channels
        WHERE playlist_id = :playlistId AND id = ANY(:order::uuid[])
     ),
     slots AS (
       SELECT sort_order, ROW_NUMBER() OVER (ORDER BY sort_order ASC, id ASC) AS rn FROM scoped
     ),
     ranked AS (
       SELECT v.id, v.ord AS rn FROM unnest(:order::uuid[]) WITH ORDINALITY AS v(id, ord)
     )
     UPDATE channels AS ch
        SET sort_order = slots.sort_order, updated_at = NOW()
       FROM ranked JOIN slots ON slots.rn = ranked.rn
      WHERE ch.id = ranked.id AND ch.sort_order IS DISTINCT FROM slots.sort_order
      RETURNING ch.id`,
    { playlistId, order: orderedIds }
  );
  return result.rows.length;
}

const CHANNEL_ORDERS = {
  name: 'lower(name) ASC, id ASC',
  name_desc: 'lower(name) DESC, id ASC',
  category: 'category_sort ASC NULLS LAST, lower(name) ASC, id ASC',
  category_desc: 'category_sort DESC NULLS LAST, lower(name) ASC, id ASC',
  epg_first: '(epg_channel_id IS NULL OR epg_channel_id = \'\') ASC, lower(name) ASC',
  alive_first: '(last_check_ok IS NOT TRUE) ASC, lower(name) ASC',
  natural: "regexp_replace(name, '[^0-9]', '', 'g') = '' ASC, NULLIF(regexp_replace(name, '[^0-9]', '', 'g'), '')::numeric ASC NULLS LAST, lower(name) ASC",
};

module.exports = {
  MAX_ROWS,
  MAX_BULK_IDS,
  CHANNEL_ORDERS,
  assertDestructive,
  ownedPlaylist,
  ownedCategory,
  ownedChannel,
  idList,
  limitRows,
  text,
  compactChannel,
  compactCategory,
  resolveChannelIds,
  reorderChannels,
  applyExplicitOrder,
  db,
};
