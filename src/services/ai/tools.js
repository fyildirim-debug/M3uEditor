/**
 * Yapay zeka asistaninin arac (function calling) kayit defteri.
 *
 * Her arac dogrudan mevcut servis katmanini cagirir; HTTP uzerinden kendi
 * API'sine geri donmez. Boylece yetkilendirme (kullanici sahipligi), dogrulama
 * ve is kurallari tek yerde kalir. Her arac `ctx.userId` ile calisir, yani
 * asistan hicbir zaman baska bir kullanicinin verisine erisemez.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');
const config = require('../../config');
const logger = require('../../config/logger');
const { createAppError } = require('../../utils/AppError');
const { safeFetchText } = require('../../utils/safeFetch');
const { removeChannelLogos } = require('../../utils/logoStorage');

const playlistService = require('../PlaylistService');
const categoryService = require('../CategoryService');
const channelService = require('../ChannelService');
const backupService = require('../BackupService');
const streamHealthService = require('../StreamHealthService');
const viewService = require('../ViewService');
const xtreamOutputService = require('../XtreamOutputService');
const exportService = require('../ExportService');
const ImportService = require('../ImportService');
const EPGService = require('../EPGService');
const FilterRuleService = require('../FilterRuleService');
const PlaylistSourceService = require('../PlaylistSourceService');
const EpgLibraryService = require('../EpgLibraryService');

const importService = new ImportService();
const epgService = new EPGService();
const filterRuleService = new FilterRuleService();
const playlistSourceService = new PlaylistSourceService();
const epgLibraryService = new EpgLibraryService();

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

function idList(ids, max = MAX_BULK_IDS) {
  if (!Array.isArray(ids) || !ids.length) throw createAppError('VALIDATION_ERROR', 'En az bir kimlik gönderin');
  if (ids.length > max) throw createAppError('VALIDATION_ERROR', `En fazla ${max} kimlik gönderilebilir`);
  const cleaned = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
  if (!cleaned.length) throw createAppError('VALIDATION_ERROR', 'Geçerli kimlik bulunamadı');
  return cleaned;
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
 * playlist + arama/kategori/filtre kombinasyonu.
 */
async function resolveChannelIds(ctx, args, { max = MAX_BULK_IDS } = {}) {
  if (Array.isArray(args.channelIds) && args.channelIds.length) return idList(args.channelIds, max);

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
  if (args.filter === 'dead') query.andWhere('last_check_ok', false);
  if (args.filter === 'unchecked') query.whereNull('last_checked_at');

  const rows = await query.select('id').orderBy('sort_order', 'asc').limit(max + 1);
  if (rows.length > max) throw createAppError('VALIDATION_ERROR', `Seçim ${max} kanaldan fazlasını kapsıyor; daralttırın`);
  if (!rows.length) throw createAppError('NOT_FOUND', 'Seçimle eşleşen kanal bulunamadı');
  return rows.map((row) => row.id);
}

/**
 * Alt kumeyi, kumenin halihazirda kapladigi sort_order yuvalarina yeniden
 * dagitir. Listenin geri kalani yerinde kalir, bu yuzden tur/kategori
 * filtreli siralama guvenlidir.
 */
async function reorderChannels(playlistId, scope, orderExpression, bindings) {
  const where = ['playlist_id = ?'];
  const params = [playlistId];
  if (scope.streamType) { where.push('stream_type = ?'); params.push(scope.streamType); }
  if (scope.categoryId) { where.push('category_id = ?'); params.push(scope.categoryId); }

  const result = await db.raw(
    `WITH scoped AS (
       SELECT c.id, c.sort_order, c.name, c.category_id, cat.sort_order AS category_sort, cat.name AS category_name
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
    [...params, ...bindings]
  );
  return result.rowCount ?? result.rows.length;
}

const CHANNEL_ORDERS = {
  name: 'lower(name) ASC, id ASC',
  name_desc: 'lower(name) DESC, id ASC',
  category: 'category_sort ASC NULLS LAST, lower(name) ASC, id ASC',
  category_desc: 'category_sort DESC NULLS LAST, lower(name) ASC, id ASC',
};

/* ────────────────────────────── ARAÇLAR ────────────────────────────── */

const tools = {
  /* ---------- Oynatma listeleri ---------- */
  list_playlists: {
    description: 'Kullanıcının tüm oynatma listelerini kanal sayısı, Xtream kaynağı ve son senkron zamanıyla listeler.',
    parameters: { type: 'object', properties: {} },
    async run(_args, ctx) {
      const playlists = await playlistService.list(ctx.userId);
      return playlists.map((playlist) => ({
        id: playlist.id,
        name: playlist.name,
        channelCount: Number(playlist.channel_count || 0),
        hasXtreamSource: playlist.has_xtream_source === true,
        streamTypes: playlist.xtream_stream_types,
        lastSyncedAt: playlist.last_synced_at,
        isShared: playlist.is_shared === true,
      }));
    },
  },

  create_playlist: {
    description: 'Boş bir oynatma listesi oluşturur. Kanallar sonradan içe aktarma veya birleştirme ile eklenir.',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Liste adı' } },
      required: ['name'],
    },
    async run(args, ctx) {
      const name = String(args.name || '').trim();
      if (!name || name.length > 255) throw createAppError('VALIDATION_ERROR', 'Geçerli bir liste adı gerekli');
      return playlistService.create(ctx.userId, { name });
    },
  },

  rename_playlist: {
    description: 'Bir oynatma listesinin adını değiştirir.',
    parameters: {
      type: 'object',
      properties: { playlistId: { type: 'string' }, name: { type: 'string' } },
      required: ['playlistId', 'name'],
    },
    run: (args, ctx) => playlistService.update(ctx.userId, args.playlistId, { name: String(args.name).trim().slice(0, 255) }),
  },

  delete_playlist: {
    description: 'Bir oynatma listesini kanalları, kategorileri ve yedekleriyle birlikte kalıcı olarak siler. Geri alınamaz — önce kullanıcıya onaylatın.',
    destructive: true,
    parameters: {
      type: 'object',
      properties: { playlistId: { type: 'string' } },
      required: ['playlistId'],
    },
    async run(args, ctx) {
      assertDestructive(ctx, 'delete_playlist');
      const playlist = await ownedPlaylist(ctx.userId, args.playlistId);
      await playlistService.delete(ctx.userId, args.playlistId);
      return { deleted: true, name: playlist.name };
    },
  },

  get_playlist_stats: {
    description: 'Bir oynatma listesinin özetini verir: tür bazında kanal sayıları, kategori sayısı, logosu/EPG eşleşmesi olmayan kanallar, yinelenen adlar ve ölü akışlar.',
    parameters: {
      type: 'object',
      properties: { playlistId: { type: 'string' } },
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      const playlist = await ownedPlaylist(ctx.userId, playlistId);
      const [counts] = (await db.raw(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE stream_type = 'live')::int AS live,
               COUNT(*) FILTER (WHERE stream_type = 'vod')::int AS vod,
               COUNT(*) FILTER (WHERE stream_type = 'series')::int AS series,
               COUNT(*) FILTER (WHERE logo_url IS NULL OR logo_url = '')::int AS missing_logo,
               COUNT(*) FILTER (WHERE epg_channel_id IS NULL OR epg_channel_id = '')::int AS missing_epg,
               COUNT(*) FILTER (WHERE category_id IS NULL)::int AS uncategorized,
               COUNT(*) FILTER (WHERE last_check_ok = false)::int AS dead,
               COUNT(*) FILTER (WHERE last_checked_at IS NULL)::int AS unchecked
          FROM channels WHERE playlist_id = ?`, [playlistId])).rows;
      const [{ count: categoryCount }] = await db('categories').where('playlist_id', playlistId).count();
      const [{ count: duplicateNames }] = (await db.raw(
        'SELECT COUNT(*)::int AS count FROM (SELECT name FROM channels WHERE playlist_id = ? GROUP BY name HAVING COUNT(*) > 1) d',
        [playlistId]
      )).rows;
      return {
        playlistId,
        name: playlist.name,
        channels: counts,
        categoryCount: Number(categoryCount),
        duplicateNameGroups: duplicateNames,
        lastSyncedAt: playlist.last_synced_at,
      };
    },
  },

  merge_playlists: {
    description: 'İki veya daha fazla oynatma listesini birleştirip yepyeni bir liste oluşturur. Kategoriler ada göre tekilleştirilir; kanallar için tekilleştirme ölçütü seçilebilir.',
    parameters: {
      type: 'object',
      properties: {
        sourcePlaylistIds: { type: 'array', items: { type: 'string' }, description: 'Birleştirilecek liste kimlikleri (en az 2)' },
        name: { type: 'string', description: 'Yeni listenin adı' },
        dedupeBy: { type: 'string', enum: ['stream_url', 'name'], description: 'Varsayılan stream_url; name aynı adlı kanalları da teker' },
        streamTypes: { type: 'array', items: { type: 'string', enum: ['live', 'vod', 'series'] }, description: 'Yalnızca bu türleri taşı' },
      },
      required: ['sourcePlaylistIds', 'name'],
    },
    async run(args, ctx) {
      const sourceIds = idList(args.sourcePlaylistIds, 20);
      if (sourceIds.length < 2) throw createAppError('VALIDATION_ERROR', 'Birleştirme için en az iki liste gerekli');
      const owned = await db('playlists').where('user_id', ctx.userId).whereIn('id', sourceIds).select('id', 'name');
      if (owned.length !== sourceIds.length) throw createAppError('NOT_FOUND', 'Listelerden biri bulunamadı');

      const dedupeBy = args.dedupeBy === 'name' ? 'name' : 'stream_url';
      const streamTypes = Array.isArray(args.streamTypes) && args.streamTypes.length
        ? args.streamTypes.filter((type) => ['live', 'vod', 'series'].includes(type))
        : null;

      return db.transaction(async (trx) => {
        const [playlist] = await trx('playlists')
          .insert({ id: uuidv4(), user_id: ctx.userId, name: String(args.name).trim().slice(0, 255) })
          .returning(['id', 'name']);

        const categoryRows = await trx('categories')
          .whereIn('playlist_id', sourceIds)
          .select('name')
          .groupBy('name')
          .orderByRaw('MIN(sort_order) ASC, MIN(name) ASC');
        const categoryIdByName = new Map();
        if (categoryRows.length) {
          const inserted = await trx('categories')
            .insert(categoryRows.map((row, index) => ({ id: uuidv4(), playlist_id: playlist.id, name: row.name, sort_order: index })))
            .returning(['id', 'name']);
          for (const row of inserted) categoryIdByName.set(row.name, row.id);
        }

        // Kaynaklar verilen sirayla taranir; ilk gelen kayit kazanir.
        // Ayni akis adresi tabloda benzersiz oldugu icin her modda elenir;
        // dedupeBy='name' ayrica ayni ada sahip kanallari da teker.
        const seenUrls = new Set();
        const seenNames = new Set();
        let sortOrder = 0;
        let inserted = 0;
        let skipped = 0;
        for (const sourceId of sourceIds) {
          let lastId = '00000000-0000-0000-0000-000000000000';
          // Kanal sayisi yuz binlere cikabildigi icin sayfali okunur.
          for (;;) {
            const query = trx('channels')
              .leftJoin('categories', 'channels.category_id', 'categories.id')
              .where('channels.playlist_id', sourceId)
              .andWhere('channels.id', '>', lastId)
              .select('channels.*', 'categories.name as category_name')
              .orderBy('channels.id', 'asc')
              .limit(1000);
            if (streamTypes) query.whereIn('channels.stream_type', streamTypes);
            const batch = await query;
            if (!batch.length) break;
            lastId = batch[batch.length - 1].id;

            const records = [];
            for (const channel of batch) {
              const nameKey = `${channel.stream_type}:${channel.name.toLocaleLowerCase('tr-TR')}`;
              if (seenUrls.has(channel.stream_url)) { skipped++; continue; }
              if (dedupeBy === 'name' && seenNames.has(nameKey)) { skipped++; continue; }
              seenUrls.add(channel.stream_url);
              seenNames.add(nameKey);
              records.push({
                id: uuidv4(),
                playlist_id: playlist.id,
                name: channel.name,
                original_name: channel.original_name,
                logo_url: channel.logo_url,
                original_logo_url: channel.original_logo_url,
                stream_url: channel.stream_url,
                epg_channel_id: channel.epg_channel_id,
                epg_source_id: channel.epg_source_id,
                category_id: channel.category_name ? categoryIdByName.get(channel.category_name) || null : null,
                stream_type: channel.stream_type,
                sort_order: sortOrder++,
                extras: channel.extras ? JSON.stringify(channel.extras) : JSON.stringify({}),
              });
            }
            if (records.length) {
              await trx('channels').insert(records).onConflict(['playlist_id', 'stream_url']).ignore();
              inserted += records.length;
            }
          }
        }

        return {
          playlistId: playlist.id,
          name: playlist.name,
          mergedFrom: owned.map((row) => row.name),
          channels: inserted,
          duplicatesSkipped: skipped,
          categories: categoryRows.length,
        };
      });
    },
  },

  /* ---------- Kategoriler ---------- */
  list_categories: {
    description: 'Bir oynatma listesinin kategorilerini sıra, gizlilik durumu ve kanal sayısıyla listeler.',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        streamType: { type: 'string', enum: ['live', 'vod', 'series'] },
      },
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      const categories = await categoryService.list(ctx.userId, playlistId, args.streamType);
      return { total: categories.length, categories: categories.slice(0, MAX_ROWS).map(compactCategory) };
    },
  },

  create_category: {
    description: 'Bir oynatma listesinde yeni kategori oluşturur.',
    parameters: {
      type: 'object',
      properties: { playlistId: { type: 'string' }, name: { type: 'string' } },
      required: ['name'],
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      const name = String(args.name || '').trim();
      if (!name || name.length > 500) throw createAppError('VALIDATION_ERROR', 'Geçerli bir kategori adı gerekli');
      return compactCategory(await categoryService.create(ctx.userId, playlistId, name));
    },
  },

  create_categories: {
    description: 'Tek çağrıda birden fazla kategori oluşturur.',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        names: { type: 'array', items: { type: 'string' } },
      },
      required: ['names'],
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      const names = idList(args.names, 200).map((name) => name.slice(0, 500));
      const created = [];
      for (const name of names) created.push(compactCategory(await categoryService.create(ctx.userId, playlistId, name)));
      return { created: created.length, categories: created };
    },
  },

  rename_category: {
    description: 'Bir kategorinin adını değiştirir.',
    parameters: {
      type: 'object',
      properties: { categoryId: { type: 'string' }, name: { type: 'string' } },
      required: ['categoryId', 'name'],
    },
    run: (args, ctx) => categoryService.update(ctx.userId, args.categoryId, { name: String(args.name).trim().slice(0, 500) }),
  },

  set_category_visibility: {
    description: 'Kategoriyi dışa aktarımlarda gizler veya yeniden görünür yapar.',
    parameters: {
      type: 'object',
      properties: { categoryId: { type: 'string' }, hidden: { type: 'boolean' } },
      required: ['categoryId', 'hidden'],
    },
    run: (args, ctx) => categoryService.update(ctx.userId, args.categoryId, { is_hidden: args.hidden === true }),
  },

  delete_categories: {
    description: 'Bir veya daha fazla kategoriyi siler. Kategorideki kanallar silinmez, kategorisiz duruma geçer.',
    destructive: true,
    parameters: {
      type: 'object',
      properties: { categoryIds: { type: 'array', items: { type: 'string' } } },
      required: ['categoryIds'],
    },
    async run(args, ctx) {
      assertDestructive(ctx, 'delete_categories');
      const ids = idList(args.categoryIds, 500);
      for (const id of ids) await categoryService.delete(ctx.userId, id);
      return { deleted: ids.length };
    },
  },

  delete_empty_categories: {
    description: 'Hiç kanalı olmayan kategorileri temizler.',
    destructive: true,
    parameters: {
      type: 'object',
      properties: { playlistId: { type: 'string' } },
    },
    async run(args, ctx) {
      assertDestructive(ctx, 'delete_empty_categories');
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const empty = await db('categories')
        .leftJoin('channels', 'categories.id', 'channels.category_id')
        .where('categories.playlist_id', playlistId)
        .groupBy('categories.id')
        .havingRaw('COUNT(channels.id) = 0')
        .select('categories.id', 'categories.name');
      for (const category of empty) await categoryService.delete(ctx.userId, category.id);
      return { deleted: empty.length, names: empty.slice(0, 50).map((category) => category.name) };
    },
  },

  sort_categories: {
    description: 'Kategori sırasını topluca değiştirir: ada göre (A-Z / Z-A), kanal sayısına göre veya verilen özel sıraya göre.',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        by: { type: 'string', enum: ['name', 'name_desc', 'channel_count', 'channel_count_asc', 'custom'] },
        order: { type: 'array', items: { type: 'string' }, description: 'by=custom ise kategori kimlikleri istenen sırada' },
      },
      required: ['by'],
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);

      if (args.by === 'custom') {
        const order = idList(args.order, 2000);
        const owned = await db('categories').where('playlist_id', playlistId).whereIn('id', order).count().first();
        if (Number(owned.count) !== order.length) throw createAppError('VALIDATION_ERROR', 'Sıralama listesi bu oynatma listesine ait olmayan kategori içeriyor');
        await db.raw(
          `UPDATE categories AS c SET sort_order = v.ord - 1
             FROM unnest(:order::uuid[]) WITH ORDINALITY AS v(id, ord)
            WHERE c.id = v.id AND c.playlist_id = :playlistId`,
          { order, playlistId }
        );
        return { sorted: order.length, by: 'custom' };
      }

      const expressions = {
        name: 'lower(cat.name) ASC',
        name_desc: 'lower(cat.name) DESC',
        channel_count: 'COUNT(ch.id) DESC, lower(cat.name) ASC',
        channel_count_asc: 'COUNT(ch.id) ASC, lower(cat.name) ASC',
      };
      const expression = expressions[args.by];
      if (!expression) throw createAppError('VALIDATION_ERROR', 'Geçersiz sıralama ölçütü');

      const result = await db.raw(
        `WITH ranked AS (
           SELECT cat.id, (ROW_NUMBER() OVER (ORDER BY ${expression}) - 1) AS position
             FROM categories cat
             LEFT JOIN channels ch ON ch.category_id = cat.id
            WHERE cat.playlist_id = ?
            GROUP BY cat.id, cat.name
         )
         UPDATE categories AS c SET sort_order = ranked.position
           FROM ranked
          WHERE c.id = ranked.id AND c.sort_order IS DISTINCT FROM ranked.position
          RETURNING c.id`,
        [playlistId]
      );
      return { sorted: result.rows.length, by: args.by };
    },
  },

  /* ---------- Kanallar ---------- */
  list_channels: {
    description: 'Kanalları arama, kategori, tür ve özel filtrelerle listeler (sayfalı). Toplu işlemler için kanal kimliklerini buradan alın.',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        search: { type: 'string' },
        categoryId: { type: 'string' },
        streamType: { type: 'string', enum: ['live', 'vod', 'series'] },
        filter: { type: 'string', enum: ['missing_logo', 'missing_epg', 'duplicate_name', 'dead', 'unchecked'] },
        page: { type: 'integer' },
        limit: { type: 'integer', description: `En fazla ${MAX_ROWS}` },
      },
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      const limit = Math.min(Math.max(Number(args.limit) || 50, 1), MAX_ROWS);
      const result = await channelService.list(ctx.userId, playlistId, {
        page: Math.max(Number(args.page) || 1, 1),
        limit,
        search: args.search,
        categoryId: args.categoryId,
        streamType: args.streamType,
        filter: args.filter,
      });
      return { total: result.total, totalPages: result.totalPages, channels: result.channels.map(compactChannel) };
    },
  },

  create_channel: {
    description: 'Elle tek bir kanal oluşturur (ad + akış adresi zorunlu).',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        name: { type: 'string' },
        streamUrl: { type: 'string' },
        categoryId: { type: 'string' },
        logoUrl: { type: 'string' },
        epgChannelId: { type: 'string' },
        streamType: { type: 'string', enum: ['live', 'vod', 'series'] },
      },
      required: ['name', 'streamUrl'],
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const name = String(args.name || '').trim();
      const streamUrl = String(args.streamUrl || '').trim();
      if (!name || name.length > 500 || !streamUrl || streamUrl.length > 5000) {
        throw createAppError('VALIDATION_ERROR', 'Geçerli kanal adı ve akış adresi gerekli');
      }
      await channelService._verifyCategoryForPlaylist(ctx.userId, playlistId, args.categoryId || null);

      let epgSourceId = null;
      if (args.epgChannelId) {
        const epgChannel = await db('epg_channels')
          .join('epg_sources', 'epg_channels.source_id', 'epg_sources.id')
          .where({ 'epg_channels.channel_id': args.epgChannelId, 'epg_sources.user_id': ctx.userId })
          .select('epg_channels.source_id')
          .first();
        if (!epgChannel) throw createAppError('VALIDATION_ERROR', 'EPG kanalı hesabınıza ait değil');
        epgSourceId = epgChannel.source_id;
      }

      const maxSort = await db('channels').where({ playlist_id: playlistId }).max('sort_order as max').first();
      const [channel] = await db('channels').insert({
        id: uuidv4(),
        playlist_id: playlistId,
        name,
        original_name: name,
        stream_url: streamUrl,
        logo_url: args.logoUrl || null,
        original_logo_url: args.logoUrl || null,
        category_id: args.categoryId || null,
        epg_channel_id: args.epgChannelId || null,
        epg_source_id: epgSourceId,
        stream_type: ['live', 'vod', 'series'].includes(args.streamType) ? args.streamType : 'live',
        sort_order: (maxSort?.max ?? -1) + 1,
        extras: JSON.stringify({}),
      }).returning('*');
      return compactChannel(channel);
    },
  },

  update_channel: {
    description: 'Tek bir kanalın adını, logosunu, akış adresini, EPG kimliğini veya kategorisini günceller.',
    parameters: {
      type: 'object',
      properties: {
        channelId: { type: 'string' },
        name: { type: 'string' },
        logoUrl: { type: 'string' },
        streamUrl: { type: 'string' },
        epgChannelId: { type: 'string' },
        categoryId: { type: 'string', description: 'null göndermek kategoriyi kaldırır' },
      },
      required: ['channelId'],
    },
    async run(args, ctx) {
      const updates = {};
      if (args.name !== undefined) updates.name = args.name;
      if (args.logoUrl !== undefined) updates.logo_url = args.logoUrl;
      if (args.streamUrl !== undefined) updates.stream_url = args.streamUrl;
      if (args.epgChannelId !== undefined) updates.epg_channel_id = args.epgChannelId;
      if (args.categoryId !== undefined) updates.category_id = args.categoryId;
      if (!Object.keys(updates).length) throw createAppError('VALIDATION_ERROR', 'Güncellenecek alan gönderin');
      return compactChannel(await channelService.update(ctx.userId, args.channelId, updates));
    },
  },

  bulk_update_channels: {
    description: 'Seçilen kanallarda ortak alanları topluca değiştirir (kategori, logo, EPG kimliği). Seçim kimlik listesiyle veya arama/filtre ile yapılabilir.',
    parameters: {
      type: 'object',
      properties: {
        channelIds: { type: 'array', items: { type: 'string' } },
        playlistId: { type: 'string' },
        search: { type: 'string' },
        categoryId: { type: 'string', description: 'Seçim filtresi olarak kategori' },
        streamType: { type: 'string', enum: ['live', 'vod', 'series'] },
        filter: { type: 'string', enum: ['missing_logo', 'missing_epg', 'dead', 'unchecked'] },
        set: {
          type: 'object',
          description: 'Uygulanacak değerler',
          properties: {
            categoryId: { type: 'string' },
            logoUrl: { type: 'string' },
            epgChannelId: { type: 'string' },
          },
        },
      },
      required: ['set'],
    },
    async run(args, ctx) {
      const ids = await resolveChannelIds(ctx, args, { max: 1000 });
      const updates = {};
      if (args.set?.categoryId !== undefined) updates.category_id = args.set.categoryId;
      if (args.set?.logoUrl !== undefined) updates.logo_url = args.set.logoUrl;
      if (args.set?.epgChannelId !== undefined) updates.epg_channel_id = args.set.epgChannelId;
      if (!Object.keys(updates).length) throw createAppError('VALIDATION_ERROR', 'set alanında güncellenecek değer yok');
      return channelService.bulkUpdate(ctx.userId, ids, updates);
    },
  },

  move_channels_to_category: {
    description: 'Seçilen kanalları hedef kategorinin sonuna taşır.',
    parameters: {
      type: 'object',
      properties: {
        channelIds: { type: 'array', items: { type: 'string' } },
        playlistId: { type: 'string' },
        search: { type: 'string' },
        streamType: { type: 'string', enum: ['live', 'vod', 'series'] },
        targetCategoryId: { type: 'string' },
      },
      required: ['targetCategoryId'],
    },
    async run(args, ctx) {
      const ids = await resolveChannelIds(ctx, args, { max: 5000 });
      return channelService.bulkMove(ctx.userId, ids, args.targetCategoryId);
    },
  },

  bulk_rename_channels: {
    description: 'Seçilen kanallarda bul-değiştir yapar. Önce dryRun=true ile önizleyip kullanıcıya gösterin.',
    parameters: {
      type: 'object',
      properties: {
        channelIds: { type: 'array', items: { type: 'string' } },
        playlistId: { type: 'string' },
        search: { type: 'string' },
        streamType: { type: 'string', enum: ['live', 'vod', 'series'] },
        categoryId: { type: 'string' },
        find: { type: 'string' },
        replace: { type: 'string' },
        useRegex: { type: 'boolean' },
        dryRun: { type: 'boolean' },
      },
      required: ['find'],
    },
    async run(args, ctx) {
      const ids = await resolveChannelIds(ctx, args, { max: 1000 });
      if (args.dryRun) {
        return channelService.previewBulkRename(ctx.userId, ids, args.find, args.replace ?? '', args.useRegex === true);
      }
      return channelService.bulkRename(ctx.userId, ids, args.find, args.replace ?? '', args.useRegex === true);
    },
  },

  sort_channels: {
    description: 'Kanal sırasını topluca değiştirir: ada göre (A-Z / Z-A), kategori sırasına göre veya verilen özel sıraya göre. Tür ve kategori ile sınırlandırılabilir; listenin geri kalanı yerinde kalır.',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        by: { type: 'string', enum: ['name', 'name_desc', 'category', 'category_desc', 'custom'] },
        streamType: { type: 'string', enum: ['live', 'vod', 'series'] },
        categoryId: { type: 'string' },
        order: { type: 'array', items: { type: 'string' }, description: 'by=custom ise kanal kimlikleri istenen sırada' },
      },
      required: ['by'],
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const scope = { streamType: args.streamType, categoryId: args.categoryId };

      if (args.by === 'custom') {
        const order = idList(args.order, MAX_BULK_IDS);
        const owned = await db('channels').where('playlist_id', playlistId).whereIn('id', order).count().first();
        if (Number(owned.count) !== order.length) throw createAppError('VALIDATION_ERROR', 'Sıralama listesi bu oynatma listesine ait olmayan kanal içeriyor');
        // Verilen kanallar, halihazirda kapladiklari sort_order yuvalarina
        // istenen sirayla yerlestirilir; listenin geri kalani yerinde kalir.
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
          { playlistId, order }
        );
        return { sorted: result.rows.length, by: 'custom' };
      }

      const expression = CHANNEL_ORDERS[args.by];
      if (!expression) throw createAppError('VALIDATION_ERROR', 'Geçersiz sıralama ölçütü');
      const updated = await reorderChannels(playlistId, scope, expression, []);
      return { sorted: updated, by: args.by, scope };
    },
  },

  delete_channels: {
    description: 'Seçilen kanalları kalıcı olarak siler. Seçim kimlik listesiyle veya arama/filtre ile yapılabilir. Geri alınamaz — önce kullanıcıya kaç kanalın silineceğini söyleyin.',
    destructive: true,
    parameters: {
      type: 'object',
      properties: {
        channelIds: { type: 'array', items: { type: 'string' } },
        playlistId: { type: 'string' },
        search: { type: 'string' },
        nameRegex: { type: 'string' },
        categoryId: { type: 'string' },
        streamType: { type: 'string', enum: ['live', 'vod', 'series'] },
        filter: { type: 'string', enum: ['missing_logo', 'missing_epg', 'dead', 'unchecked'] },
      },
    },
    async run(args, ctx) {
      assertDestructive(ctx, 'delete_channels');
      const ids = await resolveChannelIds(ctx, args, { max: 5000 });
      return channelService.bulkDelete(ctx.userId, ids);
    },
  },

  find_duplicate_channels: {
    description: 'Aynı ada sahip kanalları gruplayarak listeler; temizlik kararları için kullanılır.',
    parameters: {
      type: 'object',
      properties: { playlistId: { type: 'string' }, limit: { type: 'integer' } },
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const limit = Math.min(Math.max(Number(args.limit) || 50, 1), MAX_ROWS);
      const rows = await db('channels')
        .where('playlist_id', playlistId)
        .select('name')
        .count('* as count')
        .groupBy('name')
        .havingRaw('COUNT(*) > 1')
        .orderBy('count', 'desc')
        .limit(limit);
      return { groups: rows.map((row) => ({ name: row.name, count: Number(row.count) })) };
    },
  },

  /* ---------- EPG ---------- */
  list_epg_sources: {
    description: 'Hesaptaki XMLTV/EPG kaynaklarını durum ve son güncelleme zamanıyla listeler.',
    parameters: { type: 'object', properties: {} },
    run: (_args, ctx) => epgService.listSources(ctx.userId),
  },

  add_epg_source: {
    description: 'Yeni bir XMLTV/EPG kaynağı ekler ve indirmeyi arka planda başlatır. Durumu list_epg_sources ile kontrol edin.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        playlistId: { type: 'string', description: 'Verilirse indirme bitince otomatik eşleştirme yapılır' },
      },
      required: ['url'],
    },
    async run(args, ctx) {
      const source = await epgService.addSource(ctx.userId, args.url);
      const playlistId = args.playlistId || ctx.playlistId;
      epgService.enqueueSource(ctx.userId, args.url, playlistId || undefined)
        .catch((error) => logger.warn({ err: error, userId: ctx.userId }, 'AI EPG import failed'));
      return { sourceId: source.id, url: source.url, status: 'processing', note: 'İndirme arka planda sürüyor' };
    },
  },

  refresh_epg_source: {
    description: 'Var olan bir EPG kaynağını yeniden indirir (arka planda).',
    parameters: {
      type: 'object',
      properties: { sourceId: { type: 'string' }, force: { type: 'boolean', description: 'Rehber küçülse bile değiştir' } },
      required: ['sourceId'],
    },
    async run(args, ctx) {
      const source = await db('epg_sources').where({ id: args.sourceId, user_id: ctx.userId }).first('id');
      if (!source) throw createAppError('NOT_FOUND', 'EPG kaynağı bulunamadı');
      epgService.refreshSource(ctx.userId, args.sourceId, { force: args.force === true })
        .catch((error) => logger.warn({ err: error, sourceId: args.sourceId }, 'AI EPG refresh failed'));
      return { sourceId: args.sourceId, status: 'processing' };
    },
  },

  delete_epg_source: {
    description: 'Bir EPG kaynağını ve rehber verisini siler.',
    destructive: true,
    parameters: {
      type: 'object',
      properties: { sourceId: { type: 'string' } },
      required: ['sourceId'],
    },
    async run(args, ctx) {
      assertDestructive(ctx, 'delete_epg_source');
      await epgService.deleteSource(ctx.userId, args.sourceId);
      return { deleted: true };
    },
  },

  auto_match_epg: {
    description: 'Oynatma listesindeki kanalları EPG kaynaklarındaki rehber kanallarıyla ad benzerliğine göre otomatik eşleştirir.',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        stripPrefixes: { type: 'array', items: { type: 'string' }, description: 'Eşleştirme öncesi addan atılacak ön ekler (TR:, HD gibi)' },
        stripSuffixes: { type: 'array', items: { type: 'string' } },
        ignoreWords: { type: 'array', items: { type: 'string' } },
      },
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const settings = (args.stripPrefixes || args.stripSuffixes || args.ignoreWords)
        ? { stripPrefixes: args.stripPrefixes, stripSuffixes: args.stripSuffixes, ignoreWords: args.ignoreWords }
        : null;
      const result = await epgService.autoMatch(ctx.userId, playlistId, settings);
      return { matched: result.matched, total: result.total };
    },
  },

  apply_epg_logos: {
    description: 'EPG rehberindeki kanal ikonlarını, eşleşmiş kanalların logosu olarak uygular. overwrite=false ise yalnızca logosu olmayanlar doldurulur.',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        overwrite: { type: 'boolean', description: 'Mevcut logoların üzerine yaz (varsayılan false)' },
      },
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const overwrite = args.overwrite === true;
      if (overwrite) assertDestructive(ctx, 'apply_epg_logos(overwrite)');

      // Ayni kimlik birden fazla kaynakta olabilir; kanal basina tek ikon secilir.
      const result = await db.raw(
        `WITH targets AS (
           SELECT DISTINCT ON (c.id) c.id, c.logo_url AS previous_logo, e.icon_url
             FROM channels c
             JOIN epg_channels e ON e.channel_id = c.epg_channel_id
             JOIN epg_sources s ON s.id = e.source_id
            WHERE c.playlist_id = :playlistId
              AND s.user_id = :userId
              AND c.epg_channel_id IS NOT NULL AND c.epg_channel_id <> ''
              AND (c.epg_source_id IS NULL OR c.epg_source_id = e.source_id)
              AND e.icon_url IS NOT NULL AND e.icon_url <> ''
              AND c.logo_url IS DISTINCT FROM e.icon_url
              ${overwrite ? '' : "AND (c.logo_url IS NULL OR c.logo_url = '')"}
            ORDER BY c.id, (c.epg_source_id = e.source_id) DESC, e.source_id
         ),
         updated AS (
           UPDATE channels AS ch
              SET logo_url = t.icon_url, updated_at = NOW()
             FROM targets t
            WHERE ch.id = t.id
            RETURNING ch.id
         )
         SELECT id, previous_logo FROM targets`,
        { playlistId, userId: ctx.userId }
      );
      // Yerel dosyaya isaret eden eski logolar artik kullanilmiyor.
      const orphaned = result.rows.filter((row) => typeof row.previous_logo === 'string' && row.previous_logo.startsWith('/logos/'));
      if (orphaned.length) await removeChannelLogos(orphaned.map((row) => row.id));
      return { updated: result.rows.length, overwrite };
    },
  },

  search_epg_channels: {
    description: 'EPG kaynaklarındaki rehber kanallarını adına göre arar (tvg-id bulmak için).',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' }, limit: { type: 'integer' } },
      required: ['query'],
    },
    run: (args, ctx) => epgService.searchEpgChannels(ctx.userId, args.query, Math.min(Number(args.limit) || 15, 50)),
  },

  assign_epg_to_channel: {
    description: 'Belirli bir kanala EPG (tvg-id) kimliği atar veya null göndererek kaldırır.',
    parameters: {
      type: 'object',
      properties: {
        channelId: { type: 'string' },
        epgChannelId: { type: 'string', description: 'Boş metin gönderilirse eşleşme kaldırılır' },
      },
      required: ['channelId'],
    },
    async run(args, ctx) {
      const channel = await db('channels')
        .join('playlists', 'channels.playlist_id', 'playlists.id')
        .where({ 'channels.id': args.channelId, 'playlists.user_id': ctx.userId })
        .select('channels.id')
        .first();
      if (!channel) throw createAppError('NOT_FOUND', 'Kanal bulunamadı');

      let sourceId = null;
      if (args.epgChannelId) {
        const match = await db('epg_channels')
          .join('epg_sources', 'epg_channels.source_id', 'epg_sources.id')
          .where({ 'epg_channels.channel_id': String(args.epgChannelId).trim(), 'epg_sources.user_id': ctx.userId })
          .select('epg_channels.source_id')
          .first();
        if (!match) throw createAppError('VALIDATION_ERROR', 'EPG kanalı hesabınıza ait değil');
        sourceId = match.source_id;
      }
      const [updated] = await db('channels').where({ id: args.channelId }).update({
        epg_channel_id: args.epgChannelId ? String(args.epgChannelId).trim() : null,
        epg_source_id: sourceId,
        updated_at: db.fn.now(),
      }).returning('*');
      return compactChannel(updated);
    },
  },

  get_epg_coverage: {
    description: 'Kaç kanalın EPG eşleşmesi olduğunu ve rehberde kaç program bulunduğunu özetler.',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const [row] = (await db.raw(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE epg_channel_id IS NOT NULL AND epg_channel_id <> '')::int AS matched
          FROM channels WHERE playlist_id = ?`, [playlistId])).rows;
      return { ...row, coverage: row.total ? Math.round((row.matched / row.total) * 100) : 0 };
    },
  },

  search_epg_library: {
    description: 'iptv-org EPG kütüphanesinde ülke/dil/anahtar kelimeye göre hazır XMLTV kaynakları arar. Bulunan adresi add_epg_source ile ekleyin.',
    parameters: {
      type: 'object',
      properties: {
        country: { type: 'string', description: 'ISO ülke kodu, örn TR' },
        language: { type: 'string' },
        q: { type: 'string' },
      },
    },
    async run(args) {
      const guides = await epgLibraryService.listGuides({ country: args.country, language: args.language, q: args.q });
      return { total: guides.length, guides: guides.slice(0, 50) };
    },
  },

  /* ---------- İçe aktarma / senkronizasyon ---------- */
  import_m3u: {
    description: 'Bir M3U adresinden kanalları içe aktarır. playlistId verilirse mevcut listeye eklenir, verilmezse yeni liste oluşturulur. Uzun sürebilir.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        playlistId: { type: 'string' },
        playlistName: { type: 'string' },
      },
      required: ['url'],
    },
    async run(args, ctx) {
      if (args.playlistId) await ownedPlaylist(ctx.userId, args.playlistId);
      const response = await safeFetchText(String(args.url).trim(), {
        timeoutMs: 120_000,
        maxBytes: config.limits.m3uBytes,
        accept: 'audio/x-mpegurl,text/plain',
      });
      return importService.importFromM3U(ctx.userId, response.text, args.playlistId || null, args.playlistName, undefined);
    },
  },

  import_xtream: {
    description: 'Xtream Codes bilgileriyle içe aktarım yapar. playlistId verilirse o listeye, verilmezse yeni bir listeye. Uzun sürebilir.',
    parameters: {
      type: 'object',
      properties: {
        serverUrl: { type: 'string' },
        username: { type: 'string' },
        password: { type: 'string' },
        streamTypes: { type: 'array', items: { type: 'string', enum: ['live', 'vod', 'series'] } },
        playlistId: { type: 'string' },
        playlistName: { type: 'string' },
      },
      required: ['serverUrl', 'username', 'password'],
    },
    async run(args, ctx) {
      if (args.playlistId) await ownedPlaylist(ctx.userId, args.playlistId);
      const credentials = {
        serverUrl: String(args.serverUrl).trim(),
        username: String(args.username).trim(),
        password: String(args.password),
        streamTypes: Array.isArray(args.streamTypes) && args.streamTypes.length ? args.streamTypes : ['live'],
        playlistName: args.playlistName,
      };
      return importService.importFromXtream(ctx.userId, credentials, undefined, args.playlistId || undefined, undefined);
    },
  },

  preview_xtream: {
    description: 'Xtream sunucusuna bağlanmadan içe aktarmadan önce mevcut kategori ve içerik türlerini önizler.',
    parameters: {
      type: 'object',
      properties: { serverUrl: { type: 'string' }, username: { type: 'string' }, password: { type: 'string' } },
      required: ['serverUrl', 'username', 'password'],
    },
    async run(args) {
      const XtreamClient = require('../XtreamClient');
      const client = new XtreamClient(String(args.serverUrl).trim(), String(args.username).trim(), String(args.password));
      const preview = await client.preview();
      // Kategori listeleri cok uzun olabilir; modele ozet don.
      const summary = {};
      for (const [type, categories] of Object.entries(preview.categories || {})) {
        summary[type] = { count: categories.length, sample: categories.slice(0, 30) };
      }
      return { ...preview, categories: summary };
    },
  },

  sync_playlist: {
    description: 'Kayıtlı Xtream kaynağından oynatma listesini günceller (yeni kanallar eklenir, kaybolanlar temizlenir).',
    parameters: {
      type: 'object',
      properties: { playlistId: { type: 'string' }, allSources: { type: 'boolean', description: 'Ek kaynakları da senkronize et' } },
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      if (args.allSources) return importService.syncAllSources(ctx.userId, playlistId, undefined, undefined);
      return importService.syncFromXtream(ctx.userId, playlistId, undefined, undefined, {});
    },
  },

  set_sync_schedule: {
    description: 'Otomatik senkronizasyon aralığını (dakika) ve senkron öncesi yedekleme davranışını ayarlar. null aralık otomatiği kapatır.',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        syncIntervalMinutes: { type: 'integer', description: '0 veya negatif değer otomatiği kapatır' },
        backupBeforeSync: { type: 'boolean' },
      },
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      const interval = args.syncIntervalMinutes === undefined
        ? undefined
        : (Number(args.syncIntervalMinutes) > 0 ? Math.trunc(Number(args.syncIntervalMinutes)) : null);
      return playlistService.updateSyncSettings(ctx.userId, playlistId, {
        syncIntervalMinutes: interval,
        backupBeforeSync: args.backupBeforeSync,
      });
    },
  },

  list_playlist_sources: {
    description: 'Bir oynatma listesine bağlı ek Xtream kaynaklarını listeler.',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    run: (args, ctx) => playlistSourceService.list(ctx.userId, args.playlistId || ctx.playlistId),
  },

  add_playlist_source: {
    description: 'Oynatma listesine ek bir Xtream kaynağı bağlar; sync_playlist(allSources=true) hepsini birleştirir.',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        serverUrl: { type: 'string' },
        username: { type: 'string' },
        password: { type: 'string' },
        label: { type: 'string' },
      },
      required: ['serverUrl', 'username', 'password'],
    },
    run: (args, ctx) => playlistSourceService.create(ctx.userId, args.playlistId || ctx.playlistId, {
      serverUrl: args.serverUrl, username: args.username, password: args.password, label: args.label,
    }),
  },

  /* ---------- Dışa aktarma / paylaşım ---------- */
  export_m3u_preview: {
    description: 'Oluşacak M3U çıktısının ilk satırlarını ve toplam boyutunu gösterir (doğrulama için).',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        streamType: { type: 'string', enum: ['live', 'vod', 'series'] },
        lines: { type: 'integer' },
      },
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      const content = await exportService.exportAsM3U(ctx.userId, playlistId, [], args.streamType || null, null);
      const lines = Math.min(Math.max(Number(args.lines) || 20, 1), 100);
      return {
        bytes: Buffer.byteLength(content, 'utf8'),
        preview: content.split('\n').slice(0, lines).join('\n'),
        downloadUrl: `${config.appUrl}/api/playlists/${playlistId}/export`,
      };
    },
  },

  share_playlist: {
    description: 'Oynatma listesi için herkese açık paylaşım bağlantısı üretir (isteğe bağlı süre ve şifre).',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        expiresInDays: { type: 'integer' },
        password: { type: 'string' },
      },
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      const share = await exportService.generateShareUrl(ctx.userId, playlistId, {
        expiresInDays: args.expiresInDays,
        password: args.password,
      });
      return { url: `${config.appUrl}${share.url}`, xmltvUrl: `${config.appUrl}${share.xmltvUrl}` };
    },
  },

  revoke_share: {
    description: 'Paylaşım bağlantısını iptal eder.',
    destructive: true,
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    async run(args, ctx) {
      assertDestructive(ctx, 'revoke_share');
      await exportService.revokeShare(ctx.userId, args.playlistId || ctx.playlistId);
      return { revoked: true };
    },
  },

  get_xtream_output: {
    description: 'Oynatma listesinin Xtream Codes çıkış (player) bilgilerini gösterir.',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    run: (args, ctx) => xtreamOutputService.getConfiguration(ctx.userId, args.playlistId || ctx.playlistId),
  },

  enable_xtream_output: {
    description: 'Oynatma listesi için Xtream Codes uyumlu çıkışı açar ve giriş bilgilerini üretir.',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    run: (args, ctx) => xtreamOutputService.enable(ctx.userId, args.playlistId || ctx.playlistId),
  },

  /* ---------- Filtre kuralları ---------- */
  list_filter_rules: {
    description: 'İçe aktarım sırasında uygulanan filtre kurallarını listeler.',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    run: (args, ctx) => filterRuleService.list(ctx.userId, args.playlistId || ctx.playlistId),
  },

  create_filter_rule: {
    description: 'İçe aktarım filtre kuralı ekler: eşleşen kanalları dışarıda bırakır (exclude=true) veya yalnızca eşleşenleri alır (exclude=false).',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        field: { type: 'string', description: 'Kuralın uygulanacağı alan, örn name veya category' },
        pattern: { type: 'string', description: 'Aranacak desen' },
        exclude: { type: 'boolean', description: 'true = eşleşenleri dışla (varsayılan)' },
        enabled: { type: 'boolean' },
      },
      required: ['field', 'pattern'],
    },
    run: (args, ctx) => filterRuleService.create(ctx.userId, args.playlistId || ctx.playlistId, {
      field: args.field, pattern: args.pattern, exclude: args.exclude, enabled: args.enabled,
    }),
  },

  delete_filter_rule: {
    description: 'Bir filtre kuralını siler.',
    destructive: true,
    parameters: { type: 'object', properties: { ruleId: { type: 'string' } }, required: ['ruleId'] },
    async run(args, ctx) {
      assertDestructive(ctx, 'delete_filter_rule');
      await filterRuleService.remove(ctx.userId, args.ruleId);
      return { deleted: true };
    },
  },

  /* ---------- Akış sağlığı ---------- */
  start_health_scan: {
    description: 'Kanalların çalışıp çalışmadığını arka planda tarar. İlerlemeyi get_health_stats ile izleyin.',
    parameters: {
      type: 'object',
      properties: { playlistId: { type: 'string' }, streamType: { type: 'string', enum: ['live', 'vod', 'series'] } },
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const job = await streamHealthService.scanPlaylist(ctx.userId, playlistId, { streamType: args.streamType });
      return { started: true, ...job };
    },
  },

  get_health_stats: {
    description: 'Akış sağlığı taramasının sonuçlarını (çalışan/ölü/kontrol edilmemiş) döndürür.',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      return streamHealthService.getStats(playlistId);
    },
  },

  /* ---------- Yedekler ---------- */
  list_backups: {
    description: 'Oynatma listesinin yedeklerini listeler.',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    run: (args, ctx) => backupService.listBackups(ctx.userId, args.playlistId || ctx.playlistId),
  },

  create_backup: {
    description: 'Oynatma listesinin anlık yedeğini alır. Riskli toplu işlemlerden önce çağırmak iyi bir alışkanlıktır.',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    run: (args, ctx) => backupService.createBackup(ctx.userId, args.playlistId || ctx.playlistId, 'manual'),
  },

  restore_backup: {
    description: 'Bir yedeği geri yükler; listenin mevcut içeriğinin yerine geçer.',
    destructive: true,
    parameters: {
      type: 'object',
      properties: { backupId: { type: 'string' }, targetPlaylistId: { type: 'string' } },
      required: ['backupId'],
    },
    async run(args, ctx) {
      assertDestructive(ctx, 'restore_backup');
      return backupService.restoreBackup(ctx.userId, args.backupId, args.targetPlaylistId || null);
    },
  },

  /* ---------- Görünümler ---------- */
  list_views: {
    description: 'Oynatma listesinin görünüm profillerini (gizlenen kategori setleri) listeler.',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    run: (args, ctx) => viewService.list(ctx.userId, args.playlistId || ctx.playlistId),
  },

  create_view: {
    description: 'Belirli kategorileri gizleyen yeni bir görünüm profili oluşturur.',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        name: { type: 'string' },
        hiddenCategoryIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['name'],
    },
    run: (args, ctx) => viewService.create(ctx.userId, args.playlistId || ctx.playlistId, {
      name: args.name,
      hiddenCategoryIds: args.hiddenCategoryIds || [],
    }),
  },
};

/** OpenAI `tools` dizisi biciminde arac tanimlari. */
function definitions() {
  return Object.entries(tools).map(([name, tool]) => ({
    type: 'function',
    function: {
      name,
      description: tool.destructive ? `[YIKICI] ${tool.description}` : tool.description,
      parameters: { ...tool.parameters, additionalProperties: false },
    },
  }));
}

function isDestructive(name) {
  return tools[name]?.destructive === true;
}

/**
 * Bir araci calistirir. Hatalar modele yapilandirilmis sekilde doner ki
 * asistan kendini duzeltebilsin; beklenmeyen hatalar loglanir.
 */
async function execute(name, args, ctx) {
  const tool = tools[name];
  if (!tool) return { ok: false, error: `Bilinmeyen araç: ${name}` };

  try {
    const result = await tool.run(args && typeof args === 'object' ? args : {}, ctx);
    return { ok: true, result: result === undefined ? { success: true } : result };
  } catch (error) {
    if (!error?.code) logger.error({ err: error, tool: name, userId: ctx.userId }, 'AI tool failed');
    else logger.info({ tool: name, code: error.code, userId: ctx.userId }, 'AI tool rejected');
    return { ok: false, error: error?.message || 'Araç çalıştırılamadı', code: error?.code };
  }
}

module.exports = { definitions, execute, isDestructive, names: Object.keys(tools) };
