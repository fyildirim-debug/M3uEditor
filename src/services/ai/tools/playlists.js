/** Oynatma listesi araclari. */

const { v4: uuidv4 } = require('uuid');
const {
  db, assertDestructive, ownedPlaylist, ownedCategory, idList, limitRows, text,
} = require('../helpers');
const { createAppError } = require('../../../utils/AppError');
const playlistService = require('../../PlaylistService');
const backupService = require('../../BackupService');

function summarize(playlist) {
  return {
    id: playlist.id,
    name: playlist.name,
    channelCount: Number(playlist.channel_count || 0),
    hasXtreamSource: playlist.has_xtream_source === true,
    streamTypes: playlist.xtream_stream_types,
    lastSyncedAt: playlist.last_synced_at,
    isShared: playlist.is_shared === true,
    syncIntervalMinutes: playlist.sync_interval_minutes ?? null,
  };
}

/** Kanallari sayfali kopyalar; yuz binlik listelerde bellegi sabit tutar. */
async function copyChannels(trx, { fromPlaylistIds, toPlaylistId, categoryIdByName, streamTypes, dedupeBy, startOrder = 0 }) {
  const seenUrls = new Set();
  const seenNames = new Set();
  let sortOrder = startOrder;
  let inserted = 0;
  let skipped = 0;

  for (const sourceId of fromPlaylistIds) {
    let lastId = '00000000-0000-0000-0000-000000000000';
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
          playlist_id: toPlaylistId,
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
  return { inserted, skipped };
}

/** Kaynak listelerin kategorilerini ada gore tekillestirip hedefte olusturur. */
async function cloneCategories(trx, fromPlaylistIds, toPlaylistId) {
  const rows = await trx('categories')
    .whereIn('playlist_id', fromPlaylistIds)
    .select('name')
    .groupBy('name')
    .orderByRaw('MIN(sort_order) ASC, MIN(name) ASC');
  const map = new Map();
  if (rows.length) {
    const inserted = await trx('categories')
      .insert(rows.map((row, index) => ({ id: uuidv4(), playlist_id: toPlaylistId, name: row.name, sort_order: index })))
      .returning(['id', 'name']);
    for (const row of inserted) map.set(row.name, row.id);
  }
  return map;
}

module.exports = {
  list_playlists: {
    description: 'Kullanıcının tüm oynatma listelerini kanal sayısı, Xtream kaynağı ve son senkron zamanıyla listeler.',
    parameters: {
      type: 'object',
      properties: { search: { type: 'string', description: 'Yalnızca adı bu metni içeren listeler' } },
    },
    async run(args, ctx) {
      const search = String(args.search || '').trim().toLocaleLowerCase('tr-TR');
      let playlists = await playlistService.list(ctx.userId);
      if (search) playlists = playlists.filter((playlist) => playlist.name.toLocaleLowerCase('tr-TR').includes(search));
      return playlists.map(summarize);
    },
  },

  get_playlist: {
    description: 'Tek bir oynatma listesinin ayrıntılarını verir (ad, Xtream kaynağı, paylaşım durumu, otomatik senkron ayarı).',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    async run(args, ctx) {
      const playlist = await ownedPlaylist(ctx.userId, args.playlistId || ctx.playlistId);
      const [{ count }] = await db('channels').where('playlist_id', playlist.id).count();
      return {
        id: playlist.id,
        name: playlist.name,
        channelCount: Number(count),
        xtreamServerUrl: playlist.xtream_server_url || null,
        xtreamUsername: playlist.xtream_username || null,
        hasXtreamPassword: Boolean(playlist.xtream_password_enc),
        streamTypes: playlist.xtream_stream_types,
        lastSyncedAt: playlist.last_synced_at,
        syncIntervalMinutes: playlist.sync_interval_minutes ?? null,
        backupBeforeSync: playlist.backup_before_sync === true,
        isShared: Boolean(playlist.share_token),
        shareExpiresAt: playlist.share_expires_at,
        xtreamOutputEnabled: playlist.output_enabled === true,
      };
    },
  },

  create_playlist: {
    description: 'Boş bir oynatma listesi oluşturur. Kanallar sonradan içe aktarma veya birleştirme ile eklenir.',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Liste adı' } },
      required: ['name'],
    },
    run: (args, ctx) => playlistService.create(ctx.userId, { name: text(args.name, { field: 'name', max: 255 }) }),
  },

  rename_playlist: {
    description: 'Bir oynatma listesinin adını değiştirir.',
    parameters: {
      type: 'object',
      properties: { playlistId: { type: 'string' }, name: { type: 'string' } },
      required: ['name'],
    },
    run: (args, ctx) => playlistService.update(ctx.userId, args.playlistId || ctx.playlistId, {
      name: text(args.name, { field: 'name', max: 255 }),
    }),
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

  duplicate_playlist: {
    description: 'Bir oynatma listesinin kategorileri ve kanallarıyla birlikte kopyasını oluşturur.',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        name: { type: 'string', description: 'Kopyanın adı' },
        streamTypes: { type: 'array', items: { type: 'string', enum: ['live', 'vod', 'series'] } },
      },
      required: ['name'],
    },
    async run(args, ctx) {
      const source = await ownedPlaylist(ctx.userId, args.playlistId || ctx.playlistId);
      const streamTypes = Array.isArray(args.streamTypes) && args.streamTypes.length
        ? args.streamTypes.filter((type) => ['live', 'vod', 'series'].includes(type))
        : null;

      return db.transaction(async (trx) => {
        const [playlist] = await trx('playlists')
          .insert({ id: uuidv4(), user_id: ctx.userId, name: text(args.name, { field: 'name', max: 255 }) })
          .returning(['id', 'name']);
        const categoryIdByName = await cloneCategories(trx, [source.id], playlist.id);
        const { inserted } = await copyChannels(trx, {
          fromPlaylistIds: [source.id],
          toPlaylistId: playlist.id,
          categoryIdByName,
          streamTypes,
          dedupeBy: 'stream_url',
        });
        return { playlistId: playlist.id, name: playlist.name, channels: inserted, categories: categoryIdByName.size };
      });
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
          .insert({ id: uuidv4(), user_id: ctx.userId, name: text(args.name, { field: 'name', max: 255 }) })
          .returning(['id', 'name']);
        const categoryIdByName = await cloneCategories(trx, sourceIds, playlist.id);
        const { inserted, skipped } = await copyChannels(trx, {
          fromPlaylistIds: sourceIds,
          toPlaylistId: playlist.id,
          categoryIdByName,
          streamTypes,
          dedupeBy,
        });
        return {
          playlistId: playlist.id,
          name: playlist.name,
          mergedFrom: owned.map((row) => row.name),
          channels: inserted,
          duplicatesSkipped: skipped,
          categories: categoryIdByName.size,
        };
      });
    },
  },

  copy_channels_to_playlist: {
    description: 'Bir listedeki kanalları (isteğe bağlı tür süzgeciyle) başka bir mevcut listeye kopyalar. Kategoriler hedefte ada göre eşleşir, yoksa oluşturulur.',
    parameters: {
      type: 'object',
      properties: {
        sourcePlaylistId: { type: 'string' },
        targetPlaylistId: { type: 'string' },
        streamTypes: { type: 'array', items: { type: 'string', enum: ['live', 'vod', 'series'] } },
      },
      required: ['sourcePlaylistId', 'targetPlaylistId'],
    },
    async run(args, ctx) {
      const source = await ownedPlaylist(ctx.userId, args.sourcePlaylistId);
      const target = await ownedPlaylist(ctx.userId, args.targetPlaylistId);
      if (source.id === target.id) throw createAppError('VALIDATION_ERROR', 'Kaynak ve hedef aynı liste olamaz');
      const streamTypes = Array.isArray(args.streamTypes) && args.streamTypes.length
        ? args.streamTypes.filter((type) => ['live', 'vod', 'series'].includes(type))
        : null;

      return db.transaction(async (trx) => {
        const existing = await trx('categories').where('playlist_id', target.id).select('id', 'name');
        const categoryIdByName = new Map(existing.map((row) => [row.name, row.id]));
        const sourceCategories = await trx('categories').where('playlist_id', source.id).select('name').groupBy('name');
        const missing = sourceCategories.filter((row) => !categoryIdByName.has(row.name));
        if (missing.length) {
          const max = await trx('categories').where('playlist_id', target.id).max('sort_order as max').first();
          const start = (max?.max ?? -1) + 1;
          const created = await trx('categories')
            .insert(missing.map((row, index) => ({ id: uuidv4(), playlist_id: target.id, name: row.name, sort_order: start + index })))
            .returning(['id', 'name']);
          for (const row of created) categoryIdByName.set(row.name, row.id);
        }

        const maxSort = await trx('channels').where('playlist_id', target.id).max('sort_order as max').first();
        const { inserted, skipped } = await copyChannels(trx, {
          fromPlaylistIds: [source.id],
          toPlaylistId: target.id,
          categoryIdByName,
          streamTypes,
          dedupeBy: 'stream_url',
          startOrder: (maxSort?.max ?? -1) + 1,
        });
        return { copied: inserted, skipped, targetPlaylistId: target.id };
      });
    },
  },

  clear_playlist: {
    description: 'Bir listenin tüm kanallarını (isteğe bağlı tür süzgeciyle) siler; liste ve kategoriler kalır. Geri alınamaz.',
    destructive: true,
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        streamType: { type: 'string', enum: ['live', 'vod', 'series'] },
      },
      required: ['playlistId'],
    },
    async run(args, ctx) {
      assertDestructive(ctx, 'clear_playlist');
      const playlist = await ownedPlaylist(ctx.userId, args.playlistId);
      const query = db('channels').where('playlist_id', playlist.id);
      if (args.streamType) query.andWhere('stream_type', args.streamType);
      const deleted = await query.del();
      return { deleted, playlistId: playlist.id };
    },
  },

  get_playlist_stats: {
    description: 'Bir oynatma listesinin özetini verir: tür bazında kanal sayıları, kategori sayısı, logosu/EPG eşleşmesi olmayan kanallar, yinelenen adlar ve ölü akışlar.',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
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

  count_channels: {
    description: 'Filtreye uyan kanal sayısını döndürür (listelemeden hızlı sayım).',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        search: { type: 'string' },
        categoryId: { type: 'string' },
        streamType: { type: 'string', enum: ['live', 'vod', 'series'] },
      },
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const query = db('channels').where('playlist_id', playlistId);
      if (args.streamType) query.andWhere('stream_type', args.streamType);
      if (args.categoryId) query.andWhere('category_id', args.categoryId);
      if (args.search) query.andWhereRaw('name ILIKE ?', [`%${args.search}%`]);
      const [{ count }] = await query.count();
      return { count: Number(count) };
    },
  },

  compare_playlists: {
    description: 'İki listeyi karşılaştırır: her iki listede ortak, yalnızca birinde olan kanal sayıları ve örnek adlar.',
    parameters: {
      type: 'object',
      properties: {
        playlistAId: { type: 'string' },
        playlistBId: { type: 'string' },
        by: { type: 'string', enum: ['name', 'stream_url'], description: 'Karşılaştırma ölçütü, varsayılan name' },
        limit: { type: 'integer' },
      },
      required: ['playlistAId', 'playlistBId'],
    },
    async run(args, ctx) {
      await ownedPlaylist(ctx.userId, args.playlistAId);
      await ownedPlaylist(ctx.userId, args.playlistBId);
      const column = args.by === 'stream_url' ? 'stream_url' : 'name';
      const limit = limitRows(args.limit, 25);
      const [row] = (await db.raw(
        `WITH a AS (SELECT DISTINCT ${column} AS key FROM channels WHERE playlist_id = :a),
              b AS (SELECT DISTINCT ${column} AS key FROM channels WHERE playlist_id = :b)
         SELECT (SELECT COUNT(*)::int FROM a JOIN b USING (key)) AS common,
                (SELECT COUNT(*)::int FROM a WHERE key NOT IN (SELECT key FROM b)) AS only_a,
                (SELECT COUNT(*)::int FROM b WHERE key NOT IN (SELECT key FROM a)) AS only_b,
                (SELECT COALESCE(json_agg(key), '[]'::json) FROM (SELECT key FROM a WHERE key NOT IN (SELECT key FROM b) ORDER BY key LIMIT :limit) s) AS only_a_sample,
                (SELECT COALESCE(json_agg(key), '[]'::json) FROM (SELECT key FROM b WHERE key NOT IN (SELECT key FROM a) ORDER BY key LIMIT :limit) s) AS only_b_sample`,
        { a: args.playlistAId, b: args.playlistBId, limit }
      )).rows;
      return row;
    },
  },

  set_playlist_xtream_credentials: {
    description: 'Bir listeye Xtream sunucu adresi, kullanıcı adı ve şifresini kaydeder; sonrasında sync_playlist kullanılabilir.',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        serverUrl: { type: 'string' },
        username: { type: 'string' },
        password: { type: 'string' },
      },
      required: ['serverUrl', 'username', 'password'],
    },
    run: (args, ctx) => playlistService.update(ctx.userId, args.playlistId || ctx.playlistId, {
      xtreamServerUrl: text(args.serverUrl, { field: 'serverUrl', max: 2048 }),
      xtreamUsername: text(args.username, { field: 'username', max: 500 }),
      xtreamPassword: text(args.password, { field: 'password', max: 500 }),
    }),
  },

  set_sync_schedule: {
    description: 'Otomatik senkronizasyon aralığını (dakika) ve senkron öncesi yedekleme davranışını ayarlar. 0 veya negatif değer otomatiği kapatır.',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        syncIntervalMinutes: { type: 'integer', description: '0 veya negatif değer otomatiği kapatır' },
        backupBeforeSync: { type: 'boolean' },
      },
    },
    async run(args, ctx) {
      const interval = args.syncIntervalMinutes === undefined
        ? undefined
        : (Number(args.syncIntervalMinutes) > 0 ? Math.trunc(Number(args.syncIntervalMinutes)) : null);
      return playlistService.updateSyncSettings(ctx.userId, args.playlistId || ctx.playlistId, {
        syncIntervalMinutes: interval,
        backupBeforeSync: args.backupBeforeSync,
      });
    },
  },

  list_auto_sync_playlists: {
    description: 'Otomatik senkronizasyonu açık olan listeleri ve aralıklarını gösterir.',
    parameters: { type: 'object', properties: { onlyEnabled: { type: 'boolean' } } },
    async run(args, ctx) {
      const query = db('playlists').where('user_id', ctx.userId)
        .select('id', 'name', 'sync_interval_minutes', 'backup_before_sync', 'last_synced_at');
      if (args.onlyEnabled !== false) query.whereNotNull('sync_interval_minutes');
      return query.orderBy('name');
    },
  },

  create_backup: {
    description: 'Oynatma listesinin anlık yedeğini alır. Riskli toplu işlemlerden önce çağırmak iyi bir alışkanlıktır.',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    run: (args, ctx) => backupService.createBackup(ctx.userId, args.playlistId || ctx.playlistId, 'manual'),
  },

  list_backups: {
    description: 'Oynatma listesinin yedeklerini listeler.',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    run: (args, ctx) => backupService.listBackups(ctx.userId, args.playlistId || ctx.playlistId),
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

  delete_backup: {
    description: 'Bir yedeği siler.',
    destructive: true,
    parameters: { type: 'object', properties: { backupId: { type: 'string' } }, required: ['backupId'] },
    async run(args, ctx) {
      assertDestructive(ctx, 'delete_backup');
      await backupService.deleteBackup(ctx.userId, args.backupId);
      return { deleted: true };
    },
  },

  get_backup_download_url: {
    description: 'Bir yedeğin indirme adresini verir (oturum açmış kullanıcı için).',
    parameters: { type: 'object', properties: { backupId: { type: 'string' } }, required: ['backupId'] },
    async run(args, ctx) {
      await backupService.assertBackupOwnership(ctx.userId, args.backupId);
      return { downloadPath: `/api/backups/${args.backupId}/download` };
    },
  },

  move_channels_between_playlists: {
    description: 'Seçili kanalları başka bir listeye taşır (kaynaktan silinir). Kategoriler hedefte ada göre eşleşir.',
    destructive: true,
    parameters: {
      type: 'object',
      properties: {
        channelIds: { type: 'array', items: { type: 'string' } },
        targetPlaylistId: { type: 'string' },
      },
      required: ['channelIds', 'targetPlaylistId'],
    },
    async run(args, ctx) {
      assertDestructive(ctx, 'move_channels_between_playlists');
      const ids = idList(args.channelIds, 2000);
      const target = await ownedPlaylist(ctx.userId, args.targetPlaylistId);
      const owned = await db('channels')
        .join('playlists', 'channels.playlist_id', 'playlists.id')
        .whereIn('channels.id', ids)
        .andWhere('playlists.user_id', ctx.userId)
        .leftJoin('categories', 'channels.category_id', 'categories.id')
        .select('channels.*', 'categories.name as category_name');
      if (owned.length !== ids.length) throw createAppError('NOT_FOUND', 'Kanallardan biri hesabınıza ait değil');

      return db.transaction(async (trx) => {
        const existing = await trx('categories').where('playlist_id', target.id).select('id', 'name');
        const categoryIdByName = new Map(existing.map((row) => [row.name, row.id]));
        const missingNames = [...new Set(owned.map((row) => row.category_name).filter((name) => name && !categoryIdByName.has(name)))];
        if (missingNames.length) {
          const max = await trx('categories').where('playlist_id', target.id).max('sort_order as max').first();
          const start = (max?.max ?? -1) + 1;
          const created = await trx('categories')
            .insert(missingNames.map((name, index) => ({ id: uuidv4(), playlist_id: target.id, name, sort_order: start + index })))
            .returning(['id', 'name']);
          for (const row of created) categoryIdByName.set(row.name, row.id);
        }

        const maxSort = await trx('channels').where('playlist_id', target.id).max('sort_order as max').first();
        let order = (maxSort?.max ?? -1) + 1;
        let moved = 0;
        for (const channel of owned) {
          const updated = await trx('channels').where('id', channel.id).update({
            playlist_id: target.id,
            category_id: channel.category_name ? categoryIdByName.get(channel.category_name) || null : null,
            sort_order: order++,
            updated_at: trx.fn.now(),
          });
          moved += updated;
        }
        return { moved, targetPlaylistId: target.id };
      });
    },
  },

  copy_category_to_playlist: {
    description: 'Bir kategoriyi içindeki kanallarla birlikte başka bir listeye kopyalar.',
    parameters: {
      type: 'object',
      properties: { categoryId: { type: 'string' }, targetPlaylistId: { type: 'string' } },
      required: ['categoryId', 'targetPlaylistId'],
    },
    async run(args, ctx) {
      const category = await ownedCategory(ctx.userId, args.categoryId);
      const target = await ownedPlaylist(ctx.userId, args.targetPlaylistId);

      return db.transaction(async (trx) => {
        let targetCategory = await trx('categories').where({ playlist_id: target.id, name: category.name }).first();
        if (!targetCategory) {
          const max = await trx('categories').where('playlist_id', target.id).max('sort_order as max').first();
          [targetCategory] = await trx('categories')
            .insert({ id: uuidv4(), playlist_id: target.id, name: category.name, sort_order: (max?.max ?? -1) + 1 })
            .returning('*');
        }
        const channels = await trx('channels').where('category_id', category.id).orderBy('sort_order');
        const maxSort = await trx('channels').where('playlist_id', target.id).max('sort_order as max').first();
        let order = (maxSort?.max ?? -1) + 1;
        const records = channels.map((channel) => ({
          id: uuidv4(),
          playlist_id: target.id,
          name: channel.name,
          original_name: channel.original_name,
          logo_url: channel.logo_url,
          original_logo_url: channel.original_logo_url,
          stream_url: channel.stream_url,
          epg_channel_id: channel.epg_channel_id,
          epg_source_id: channel.epg_source_id,
          category_id: targetCategory.id,
          stream_type: channel.stream_type,
          sort_order: order++,
          extras: channel.extras ? JSON.stringify(channel.extras) : JSON.stringify({}),
        }));
        if (records.length) await trx('channels').insert(records).onConflict(['playlist_id', 'stream_url']).ignore();
        return { copied: records.length, targetCategoryId: targetCategory.id };
      });
    },
  },
};
