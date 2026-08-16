/** Kanal araclari. */

const { v4: uuidv4 } = require('uuid');
const {
  db, CHANNEL_ORDERS, assertDestructive, ownedPlaylist, ownedChannel, idList, limitRows, text,
  compactChannel, resolveChannelIds, reorderChannels, applyExplicitOrder,
} = require('../helpers');
const { createAppError } = require('../../../utils/AppError');
const channelService = require('../../ChannelService');
const streamHealthService = require('../../StreamHealthService');
const streamRepairService = require('../../StreamRepairService');

const SELECTION_PROPERTIES = {
  channelIds: { type: 'array', items: { type: 'string' }, description: 'Doğrudan kanal kimlikleri' },
  playlistId: { type: 'string' },
  search: { type: 'string', description: 'Ada göre seçim' },
  nameRegex: { type: 'string', description: 'Ada göre düzenli ifade seçimi' },
  categoryId: { type: 'string' },
  streamType: { type: 'string', enum: ['live', 'vod', 'series'] },
  filter: { type: 'string', enum: ['missing_logo', 'missing_epg', 'has_logo', 'dead', 'alive', 'unchecked'] },
};

/** Ad donusturen araclarin ortak govdesi: sec, donustur, yaz. */
async function transformNames(ctx, args, transform, { max = 5000 } = {}) {
  const ids = await resolveChannelIds(ctx, args, { max });
  const channels = await db('channels').whereIn('id', ids).select('id', 'name');
  const changes = [];
  for (const channel of channels) {
    const next = transform(channel.name).replace(/\s+/g, ' ').trim().slice(0, 500);
    if (next && next !== channel.name) changes.push({ id: channel.id, before: channel.name, after: next });
  }
  if (args.dryRun) return { affected: changes.length, dryRun: true, samples: changes.slice(0, 20) };

  await db.transaction(async (trx) => {
    for (const change of changes) await trx('channels').where('id', change.id).update({ name: change.after, updated_at: trx.fn.now() });
  });
  return { updated: changes.length, samples: changes.slice(0, 20) };
}

const QUALITY_TAGS = /\b(4K|UHD|FHD|HD|SD|HEVC|H265|H\.265|1080P?|720P?|480P?|2160P?|RAW|MULTI|BACKUP)\b/gi;

module.exports = {
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
        limit: { type: 'integer', description: 'En fazla 200' },
      },
    },
    async run(args, ctx) {
      const result = await channelService.list(ctx.userId, args.playlistId || ctx.playlistId, {
        page: Math.max(Number(args.page) || 1, 1),
        limit: limitRows(args.limit, 50),
        search: args.search,
        categoryId: args.categoryId,
        streamType: args.streamType,
        filter: args.filter,
      });
      return { total: result.total, totalPages: result.totalPages, channels: result.channels.map(compactChannel) };
    },
  },

  get_channel: {
    description: 'Tek bir kanalın tüm alanlarını verir (akış adresi, logo, EPG kimliği, sağlık durumu).',
    parameters: { type: 'object', properties: { channelId: { type: 'string' } }, required: ['channelId'] },
    async run(args, ctx) {
      const channel = await ownedChannel(ctx.userId, args.channelId);
      return {
        ...compactChannel(channel),
        streamUrl: channel.stream_url,
        logoUrl: channel.logo_url,
        originalName: channel.original_name,
        sortOrder: channel.sort_order,
        lastCheckedAt: channel.last_checked_at,
        lastCheckOk: channel.last_check_ok,
        extras: channel.extras || {},
      };
    },
  },

  search_channels: {
    description: 'Kanal adında bulanık (trigram) arama yapar; yazım farklarını tolere eder.',
    parameters: {
      type: 'object',
      properties: { playlistId: { type: 'string' }, query: { type: 'string' }, limit: { type: 'integer' } },
      required: ['query'],
    },
    async run(args, ctx) {
      const results = await channelService.search(ctx.userId, args.playlistId || ctx.playlistId, text(args.query, { field: 'query' }));
      return results.slice(0, limitRows(args.limit, 25)).map(compactChannel);
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
      const name = text(args.name, { field: 'name' });
      const streamUrl = text(args.streamUrl, { field: 'streamUrl', max: 5000 });
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

  create_channels: {
    description: 'Tek çağrıda birden fazla kanal ekler. Konuşarak sıfırdan kanal listesi oluşturmak için kullanılır.',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        channels: {
          type: 'array',
          description: 'Her biri name ve streamUrl içeren kanallar',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              streamUrl: { type: 'string' },
              logoUrl: { type: 'string' },
              epgChannelId: { type: 'string' },
              categoryName: { type: 'string', description: 'Yoksa kategori oluşturulur' },
              streamType: { type: 'string', enum: ['live', 'vod', 'series'] },
            },
          },
        },
      },
      required: ['channels'],
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const input = Array.isArray(args.channels) ? args.channels : [];
      if (!input.length) throw createAppError('VALIDATION_ERROR', 'En az bir kanal gönderin');
      if (input.length > 500) throw createAppError('VALIDATION_ERROR', 'Tek çağrıda en fazla 500 kanal eklenebilir');

      return db.transaction(async (trx) => {
        const existing = await trx('categories').where('playlist_id', playlistId).select('id', 'name');
        const byName = new Map(existing.map((row) => [row.name.toLocaleLowerCase('tr-TR'), row.id]));
        let categoryOrder = existing.length;

        const maxSort = await trx('channels').where('playlist_id', playlistId).max('sort_order as max').first();
        let order = (maxSort?.max ?? -1) + 1;
        const records = [];

        for (const item of input) {
          const name = text(item?.name, { field: 'name' });
          const streamUrl = text(item?.streamUrl, { field: 'streamUrl', max: 5000 });
          let categoryId = null;
          if (item?.categoryName) {
            const key = String(item.categoryName).trim().toLocaleLowerCase('tr-TR');
            if (!byName.has(key)) {
              const [created] = await trx('categories')
                .insert({ id: uuidv4(), playlist_id: playlistId, name: String(item.categoryName).trim().slice(0, 500), sort_order: categoryOrder++ })
                .returning(['id']);
              byName.set(key, created.id);
            }
            categoryId = byName.get(key);
          }
          records.push({
            id: uuidv4(),
            playlist_id: playlistId,
            name,
            original_name: name,
            stream_url: streamUrl,
            logo_url: item?.logoUrl || null,
            original_logo_url: item?.logoUrl || null,
            category_id: categoryId,
            epg_channel_id: item?.epgChannelId || null,
            stream_type: ['live', 'vod', 'series'].includes(item?.streamType) ? item.streamType : 'live',
            sort_order: order++,
            extras: JSON.stringify({}),
          });
        }

        const inserted = await trx('channels').insert(records).onConflict(['playlist_id', 'stream_url']).ignore().returning('id');
        return { created: inserted.length, skippedDuplicates: records.length - inserted.length, playlistId };
      });
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
        categoryId: { type: 'string' },
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
    description: 'Seçilen kanallarda ortak alanları topluca değiştirir (kategori, logo, EPG kimliği).',
    parameters: {
      type: 'object',
      properties: {
        ...SELECTION_PROPERTIES,
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
      properties: { ...SELECTION_PROPERTIES, targetCategoryId: { type: 'string' } },
      required: ['targetCategoryId'],
    },
    async run(args, ctx) {
      const ids = await resolveChannelIds(ctx, args, { max: 5000 });
      return channelService.bulkMove(ctx.userId, ids, args.targetCategoryId);
    },
  },

  remove_channels_from_category: {
    description: 'Seçilen kanalları kategorisiz duruma getirir (kanallar silinmez).',
    parameters: { type: 'object', properties: SELECTION_PROPERTIES },
    async run(args, ctx) {
      const ids = await resolveChannelIds(ctx, args, { max: 5000 });
      const updated = await db('channels').whereIn('id', ids).update({ category_id: null, updated_at: db.fn.now() });
      return { updated };
    },
  },

  bulk_rename_channels: {
    description: 'Seçilen kanallarda bul-değiştir yapar. Önce dryRun=true ile önizleyip kullanıcıya gösterin.',
    parameters: {
      type: 'object',
      properties: {
        ...SELECTION_PROPERTIES,
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

  add_channel_prefix: {
    description: 'Seçilen kanal adlarının başına önek ekler.',
    parameters: { type: 'object', properties: { ...SELECTION_PROPERTIES, prefix: { type: 'string' }, dryRun: { type: 'boolean' } }, required: ['prefix'] },
    run(args, ctx) {
      const prefix = text(args.prefix, { field: 'prefix', max: 100 });
      return transformNames(ctx, args, (name) => (name.startsWith(prefix) ? name : `${prefix}${name}`));
    },
  },

  add_channel_suffix: {
    description: 'Seçilen kanal adlarının sonuna sonek ekler.',
    parameters: { type: 'object', properties: { ...SELECTION_PROPERTIES, suffix: { type: 'string' }, dryRun: { type: 'boolean' } }, required: ['suffix'] },
    run(args, ctx) {
      const suffix = text(args.suffix, { field: 'suffix', max: 100 });
      return transformNames(ctx, args, (name) => (name.endsWith(suffix) ? name : `${name}${suffix}`));
    },
  },

  strip_channel_prefix: {
    description: 'Kanal adlarının başındaki belirtilen öneki (varsa) kaldırır.',
    parameters: { type: 'object', properties: { ...SELECTION_PROPERTIES, prefix: { type: 'string' }, dryRun: { type: 'boolean' } }, required: ['prefix'] },
    run(args, ctx) {
      const prefix = text(args.prefix, { field: 'prefix', max: 100 });
      return transformNames(ctx, args, (name) => (name.startsWith(prefix) ? name.slice(prefix.length) : name));
    },
  },

  strip_channel_suffix: {
    description: 'Kanal adlarının sonundaki belirtilen soneki (varsa) kaldırır.',
    parameters: { type: 'object', properties: { ...SELECTION_PROPERTIES, suffix: { type: 'string' }, dryRun: { type: 'boolean' } }, required: ['suffix'] },
    run(args, ctx) {
      const suffix = text(args.suffix, { field: 'suffix', max: 100 });
      return transformNames(ctx, args, (name) => (name.endsWith(suffix) ? name.slice(0, -suffix.length) : name));
    },
  },

  normalize_channel_names: {
    description: 'Kanal adlarını temizler: baş/son boşluk, çoklu boşluk ve isteğe bağlı olarak süslü karakterler.',
    parameters: {
      type: 'object',
      properties: { ...SELECTION_PROPERTIES, removeSymbols: { type: 'boolean', description: '● ★ | gibi süs karakterlerini at' }, dryRun: { type: 'boolean' } },
    },
    run(args, ctx) {
      return transformNames(ctx, args, (name) => (args.removeSymbols
        ? name.replace(/[●★☆▪◆■□▶►|~_]+/g, ' ')
        : name));
    },
  },

  change_channel_name_case: {
    description: 'Kanal adlarının harf düzenini değiştirir: BÜYÜK, küçük veya Baş Harfler Büyük.',
    parameters: {
      type: 'object',
      properties: {
        ...SELECTION_PROPERTIES,
        mode: { type: 'string', enum: ['upper', 'lower', 'title'] },
        dryRun: { type: 'boolean' },
      },
      required: ['mode'],
    },
    run(args, ctx) {
      const mode = args.mode;
      if (!['upper', 'lower', 'title'].includes(mode)) throw createAppError('VALIDATION_ERROR', 'Geçersiz mode');
      return transformNames(ctx, args, (name) => {
        if (mode === 'upper') return name.toLocaleUpperCase('tr-TR');
        if (mode === 'lower') return name.toLocaleLowerCase('tr-TR');
        return name.split(' ')
          .map((word) => word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1).toLocaleLowerCase('tr-TR'))
          .join(' ');
      });
    },
  },

  remove_quality_tags: {
    description: 'Kanal adlarındaki HD, FHD, 4K, UHD, H265 gibi kalite etiketlerini temizler.',
    parameters: { type: 'object', properties: { ...SELECTION_PROPERTIES, dryRun: { type: 'boolean' } } },
    run(args, ctx) {
      return transformNames(ctx, args, (name) => name.replace(QUALITY_TAGS, ' ').replace(/[-–—:|]\s*$/, ''));
    },
  },

  replace_in_stream_urls: {
    description: 'Seçilen kanalların akış adreslerinde bul-değiştir yapar (sağlayıcı alan adı değişimi gibi). dryRun ile önizleyin.',
    destructive: true,
    parameters: {
      type: 'object',
      properties: { ...SELECTION_PROPERTIES, find: { type: 'string' }, replace: { type: 'string' }, dryRun: { type: 'boolean' } },
      required: ['find', 'replace'],
    },
    async run(args, ctx) {
      if (!args.dryRun) assertDestructive(ctx, 'replace_in_stream_urls');
      const ids = await resolveChannelIds(ctx, args, { max: 5000 });
      const find = text(args.find, { field: 'find', max: 500 });
      const replace = String(args.replace ?? '').slice(0, 500);

      const channels = await db('channels').whereIn('id', ids).select('id', 'name', 'stream_url');
      const changes = channels
        .map((channel) => ({ id: channel.id, name: channel.name, before: channel.stream_url, after: channel.stream_url.split(find).join(replace) }))
        .filter((change) => change.after !== change.before && change.after.length <= 5000);

      if (args.dryRun) return { affected: changes.length, dryRun: true, samples: changes.slice(0, 10) };
      await db.transaction(async (trx) => {
        for (const change of changes) {
          await trx('channels').where('id', change.id).update({ stream_url: change.after, updated_at: trx.fn.now() });
        }
      });
      return { updated: changes.length };
    },
  },

  set_channels_stream_type: {
    description: 'Seçilen kanalların içerik türünü (canlı/film/dizi) değiştirir.',
    parameters: {
      type: 'object',
      properties: { ...SELECTION_PROPERTIES, targetStreamType: { type: 'string', enum: ['live', 'vod', 'series'] } },
      required: ['targetStreamType'],
    },
    async run(args, ctx) {
      if (!['live', 'vod', 'series'].includes(args.targetStreamType)) throw createAppError('VALIDATION_ERROR', 'Geçersiz tür');
      const ids = await resolveChannelIds(ctx, args, { max: 5000 });
      const updated = await db('channels').whereIn('id', ids).update({ stream_type: args.targetStreamType, updated_at: db.fn.now() });
      return { updated, streamType: args.targetStreamType };
    },
  },

  clear_channel_logos: {
    description: 'Seçilen kanalların logolarını kaldırır.',
    destructive: true,
    parameters: { type: 'object', properties: SELECTION_PROPERTIES },
    async run(args, ctx) {
      assertDestructive(ctx, 'clear_channel_logos');
      const ids = await resolveChannelIds(ctx, args, { max: 5000 });
      return channelService.bulkUpdate(ctx.userId, ids.slice(0, 1000), { logo_url: null });
    },
  },

  reset_channels: {
    description: 'Seçilen kanalları sağlayıcıdan gelen özgün ad ve logosuna döndürür.',
    destructive: true,
    parameters: { type: 'object', properties: SELECTION_PROPERTIES },
    async run(args, ctx) {
      assertDestructive(ctx, 'reset_channels');
      const ids = await resolveChannelIds(ctx, args, { max: 1000 });
      let reset = 0;
      for (const id of ids) { await channelService.reset(ctx.userId, id); reset++; }
      return { reset };
    },
  },

  delete_channels: {
    description: 'Seçilen kanalları kalıcı olarak siler. Geri alınamaz — önce kaç kanalın silineceğini kullanıcıya söyleyin.',
    destructive: true,
    parameters: { type: 'object', properties: SELECTION_PROPERTIES },
    async run(args, ctx) {
      assertDestructive(ctx, 'delete_channels');
      const ids = await resolveChannelIds(ctx, args, { max: 5000 });
      return channelService.bulkDelete(ctx.userId, ids);
    },
  },

  deduplicate_channels: {
    description: 'Aynı ada sahip yinelenen kanallardan ilki dışındakileri siler.',
    destructive: true,
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        streamType: { type: 'string', enum: ['live', 'vod', 'series'] },
        dryRun: { type: 'boolean' },
      },
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const params = [playlistId];
      let typeClause = '';
      if (args.streamType) { typeClause = 'AND stream_type = ?'; params.push(args.streamType); }

      const duplicates = await db.raw(
        `SELECT id FROM (
           SELECT id, ROW_NUMBER() OVER (PARTITION BY stream_type, lower(name) ORDER BY sort_order ASC, id ASC) AS rn
             FROM channels WHERE playlist_id = ? ${typeClause}
         ) ranked WHERE rn > 1`,
        params
      );
      const ids = duplicates.rows.map((row) => row.id);
      if (args.dryRun) return { duplicates: ids.length, dryRun: true };
      assertDestructive(ctx, 'deduplicate_channels');
      if (!ids.length) return { deleted: 0 };
      const chunk = ids.slice(0, 5000);
      await channelService.bulkDelete(ctx.userId, chunk);
      return { deleted: chunk.length, remaining: Math.max(0, ids.length - chunk.length) };
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
      const rows = await db('channels')
        .where('playlist_id', playlistId)
        .select('name')
        .count('* as count')
        .groupBy('name')
        .havingRaw('COUNT(*) > 1')
        .orderBy('count', 'desc')
        .limit(limitRows(args.limit, 50));
      return { groups: rows.map((row) => ({ name: row.name, count: Number(row.count) })) };
    },
  },

  sort_channels: {
    description: 'Kanal sırasını topluca değiştirir: ada göre, kategori sırasına, doğal sayı sırasına, EPG/çalışır durumuna veya verilen özel sıraya göre. Tür ve kategori ile sınırlandırılabilir.',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        by: { type: 'string', enum: ['name', 'name_desc', 'category', 'category_desc', 'natural', 'epg_first', 'alive_first', 'custom'] },
        streamType: { type: 'string', enum: ['live', 'vod', 'series'] },
        categoryId: { type: 'string' },
        order: { type: 'array', items: { type: 'string' }, description: 'by=custom ise kanal kimlikleri istenen sırada' },
      },
      required: ['by'],
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);

      if (args.by === 'custom') {
        const order = idList(args.order, 5000);
        const owned = await db('channels').where('playlist_id', playlistId).whereIn('id', order).count().first();
        if (Number(owned.count) !== order.length) throw createAppError('VALIDATION_ERROR', 'Sıralama listesi bu oynatma listesine ait olmayan kanal içeriyor');
        return { sorted: await applyExplicitOrder(playlistId, order), by: 'custom' };
      }

      const expression = CHANNEL_ORDERS[args.by];
      if (!expression) throw createAppError('VALIDATION_ERROR', 'Geçersiz sıralama ölçütü');
      const sorted = await reorderChannels(playlistId, { streamType: args.streamType, categoryId: args.categoryId }, expression);
      return { sorted, by: args.by };
    },
  },

  sort_channels_in_all_categories: {
    description: 'Her kategorinin içindeki kanalları kendi arasında ada göre sıralar; kategori sırası korunur.',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        streamType: { type: 'string', enum: ['live', 'vod', 'series'] },
        descending: { type: 'boolean' },
      },
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const categories = await db('categories').where('playlist_id', playlistId).select('id');
      const expression = args.descending ? CHANNEL_ORDERS.name_desc : CHANNEL_ORDERS.name;
      let sorted = 0;
      for (const category of categories) {
        sorted += await reorderChannels(playlistId, { streamType: args.streamType, categoryId: category.id }, expression);
      }
      return { sorted, categories: categories.length };
    },
  },

  move_channel_to_position: {
    description: 'Bir kanalı liste içinde belirli bir sıraya taşır (0 = en üst).',
    parameters: {
      type: 'object',
      properties: { channelId: { type: 'string' }, position: { type: 'integer' } },
      required: ['channelId', 'position'],
    },
    async run(args, ctx) {
      const channel = await ownedChannel(ctx.userId, args.channelId);
      const rows = await db('channels').where('playlist_id', channel.playlist_id)
        .orderBy('sort_order').orderBy('id').select('id');
      const ids = rows.map((row) => row.id).filter((id) => id !== channel.id);
      const position = Math.max(0, Math.min(Number(args.position) || 0, ids.length));
      ids.splice(position, 0, channel.id);
      await db.raw(
        `UPDATE channels AS c SET sort_order = v.ord - 1, updated_at = NOW()
           FROM unnest(:order::uuid[]) WITH ORDINALITY AS v(id, ord)
          WHERE c.id = v.id AND c.playlist_id = :playlistId AND c.sort_order IS DISTINCT FROM v.ord - 1`,
        { order: ids, playlistId: channel.playlist_id }
      );
      return { moved: channel.name, position };
    },
  },

  move_channels_to_top: {
    description: 'Seçilen kanalları listenin en başına taşır (verilen sırayla).',
    parameters: { type: 'object', properties: SELECTION_PROPERTIES },
    async run(args, ctx) {
      const ids = await resolveChannelIds(ctx, args, { max: 2000 });
      const playlistId = args.playlistId || ctx.playlistId || (await ownedChannel(ctx.userId, ids[0])).playlist_id;
      await ownedPlaylist(ctx.userId, playlistId);
      const rows = await db('channels').where('playlist_id', playlistId).orderBy('sort_order').orderBy('id').select('id');
      const selected = new Set(ids);
      const ordered = [...ids, ...rows.map((row) => row.id).filter((id) => !selected.has(id))];
      await db.raw(
        `UPDATE channels AS c SET sort_order = v.ord - 1, updated_at = NOW()
           FROM unnest(:order::uuid[]) WITH ORDINALITY AS v(id, ord)
          WHERE c.id = v.id AND c.playlist_id = :playlistId AND c.sort_order IS DISTINCT FROM v.ord - 1`,
        { order: ordered, playlistId }
      );
      return { moved: ids.length };
    },
  },

  swap_channels: {
    description: 'İki kanalın sıradaki yerlerini değiştirir.',
    parameters: {
      type: 'object',
      properties: { channelAId: { type: 'string' }, channelBId: { type: 'string' } },
      required: ['channelAId', 'channelBId'],
    },
    async run(args, ctx) {
      const a = await ownedChannel(ctx.userId, args.channelAId);
      const b = await ownedChannel(ctx.userId, args.channelBId);
      if (a.playlist_id !== b.playlist_id) throw createAppError('VALIDATION_ERROR', 'Kanallar aynı listede olmalı');
      await db.transaction(async (trx) => {
        await trx('channels').where('id', a.id).update({ sort_order: b.sort_order, updated_at: trx.fn.now() });
        await trx('channels').where('id', b.id).update({ sort_order: a.sort_order, updated_at: trx.fn.now() });
      });
      return { swapped: [a.name, b.name] };
    },
  },

  list_channels_by_ids: {
    description: 'Verilen kimliklerdeki kanalları getirir.',
    parameters: {
      type: 'object',
      properties: { channelIds: { type: 'array', items: { type: 'string' } } },
      required: ['channelIds'],
    },
    async run(args, ctx) {
      const ids = idList(args.channelIds, 200);
      const rows = await db('channels')
        .join('playlists', 'channels.playlist_id', 'playlists.id')
        .leftJoin('categories', 'channels.category_id', 'categories.id')
        .whereIn('channels.id', ids)
        .andWhere('playlists.user_id', ctx.userId)
        .select('channels.*', 'categories.name as category_name');
      return rows.map(compactChannel);
    },
  },

  test_channel: {
    description: 'Tek bir kanalın akışının çalışıp çalışmadığını sınar.',
    parameters: { type: 'object', properties: { channelId: { type: 'string' } }, required: ['channelId'] },
    async run(args, ctx) {
      const channel = await ownedChannel(ctx.userId, args.channelId);
      const result = await streamHealthService.checkUrl(channel.stream_url);
      await db('channels').where('id', channel.id).update({
        last_checked_at: new Date().toISOString(),
        last_check_ok: result.ok,
        last_check_status: result.status || null,
      });
      return { name: channel.name, ok: result.ok, status: result.status || null };
    },
  },

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
      return { started: true, total: job.total, checked: job.checked, running: job.running };
    },
  },

  get_health_scan_status: {
    description: 'Süren akış sağlığı taramasının ilerlemesini verir.',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    run: (args, ctx) => streamHealthService.getScanStatus(ctx.userId, args.playlistId || ctx.playlistId),
  },

  get_health_stats: {
    description: 'Akış sağlığı sonuçlarını (çalışan/ölü/kontrol edilmemiş) döndürür.',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      return streamHealthService.getStats(playlistId);
    },
  },

  list_dead_channels: {
    description: 'Son taramada çalışmadığı görülen kanalları listeler.',
    parameters: {
      type: 'object',
      properties: { playlistId: { type: 'string' }, limit: { type: 'integer' } },
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const [{ count }] = await db('channels').where({ playlist_id: playlistId, last_check_ok: false }).count();
      const rows = await db('channels').where({ playlist_id: playlistId, last_check_ok: false })
        .orderBy('sort_order').limit(limitRows(args.limit, 50))
        .select('id', 'name', 'last_check_status', 'last_checked_at');
      return { total: Number(count), channels: rows };
    },
  },

  repair_dead_channels: {
    description: 'Çalışmayan (ölü işaretli) kanalların akış adreslerini bir Xtream kaynağındaki karşılıklarıyla değiştirir. Kanal adı, kategorisi, logosu ve EPG eşleşmesi korunur; yalnızca adres tazelenir. Kimlik bilgisi verilmezse listenin kayıtlı Xtream kaynağı kullanılır. Yeni adres yazılmadan önce denenir; çalışmayan aday yazılmaz. Önce dryRun=true ile önizleyin.',
    destructive: true,
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        serverUrl: { type: 'string', description: 'Kaynak Xtream sunucusu (boş bırakılırsa listenin kayıtlı kaynağı)' },
        username: { type: 'string' },
        password: { type: 'string' },
        channelIds: { type: 'array', items: { type: 'string' }, description: 'Belirli kanallar; verilmezse ölü işaretli olanlar' },
        streamType: { type: 'string', enum: ['live', 'vod', 'series'] },
        onlyDead: { type: 'boolean', description: 'Yalnızca ölü işaretliler (varsayılan true)' },
        verify: { type: 'boolean', description: 'Yeni adresi yazmadan önce dene (varsayılan true)' },
        dryRun: { type: 'boolean' },
        limit: { type: 'integer' },
      },
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      if (args.dryRun !== true) assertDestructive(ctx, 'repair_dead_channels');
      return streamRepairService.repairFromXtream(ctx.userId, playlistId, {
        serverUrl: args.serverUrl,
        username: args.username,
        password: args.password,
        channelIds: args.channelIds,
        streamType: args.streamType,
        onlyDead: args.onlyDead,
        verify: args.verify,
        dryRun: args.dryRun,
        limit: args.limit,
      });
    },
  },

  delete_dead_channels: {
    description: 'Son taramada ölü olduğu görülen kanalları siler.',
    destructive: true,
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    async run(args, ctx) {
      assertDestructive(ctx, 'delete_dead_channels');
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const rows = await db('channels').where({ playlist_id: playlistId, last_check_ok: false }).select('id').limit(5000);
      if (!rows.length) return { deleted: 0 };
      return channelService.bulkDelete(ctx.userId, rows.map((row) => row.id));
    },
  },

  channel_health_by_category: {
    description: 'Kategori başına çalışan/ölü/denenmemiş kanal dağılımını verir.',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const result = await db.raw(`
        SELECT COALESCE(cat.name, 'Kategorisiz') AS category,
               COUNT(ch.id)::int AS total,
               COUNT(*) FILTER (WHERE ch.last_check_ok IS TRUE)::int AS alive,
               COUNT(*) FILTER (WHERE ch.last_check_ok IS FALSE)::int AS dead,
               COUNT(*) FILTER (WHERE ch.last_checked_at IS NULL)::int AS unchecked
          FROM channels ch
          LEFT JOIN categories cat ON cat.id = ch.category_id
         WHERE ch.playlist_id = ?
         GROUP BY cat.name
         ORDER BY dead DESC, total DESC
         LIMIT 100`, [playlistId]);
      return result.rows;
    },
  },
};
