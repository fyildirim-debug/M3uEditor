/** Kategori araclari. */

const {
  db, assertDestructive, ownedPlaylist, ownedCategory, idList, limitRows, text, compactCategory,
} = require('../helpers');
const { createAppError } = require('../../../utils/AppError');
const categoryService = require('../../CategoryService');

const CATEGORY_ORDERS = {
  name: 'lower(cat.name) ASC',
  name_desc: 'lower(cat.name) DESC',
  channel_count: 'COUNT(ch.id) DESC, lower(cat.name) ASC',
  channel_count_asc: 'COUNT(ch.id) ASC, lower(cat.name) ASC',
  created: 'MIN(cat.created_at) ASC',
};

/** Kategori adlarini toplu donusturen araclarin ortak govdesi. */
async function transformCategoryNames(ctx, playlistId, transform) {
  await ownedPlaylist(ctx.userId, playlistId);
  const categories = await db('categories').where('playlist_id', playlistId).select('id', 'name');
  const changes = [];
  for (const category of categories) {
    const next = transform(category.name).trim().slice(0, 500);
    if (next && next !== category.name) changes.push({ id: category.id, before: category.name, after: next });
  }
  await db.transaction(async (trx) => {
    for (const change of changes) await trx('categories').where('id', change.id).update({ name: change.after });
  });
  return { updated: changes.length, samples: changes.slice(0, 20) };
}

module.exports = {
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
      const categories = await categoryService.list(ctx.userId, args.playlistId || ctx.playlistId, args.streamType);
      return { total: categories.length, categories: categories.slice(0, 200).map(compactCategory) };
    },
  },

  get_category: {
    description: 'Tek bir kategorinin ayrıntılarını ve kanal sayısını verir.',
    parameters: { type: 'object', properties: { categoryId: { type: 'string' } }, required: ['categoryId'] },
    async run(args, ctx) {
      const category = await ownedCategory(ctx.userId, args.categoryId);
      const [{ count }] = await db('channels').where('category_id', category.id).count();
      return { ...compactCategory(category), playlistId: category.playlist_id, channelCount: Number(count) };
    },
  },

  find_category_by_name: {
    description: 'Kategori adına göre arama yapar; kimlik bulmanın en hızlı yolu.',
    parameters: {
      type: 'object',
      properties: { playlistId: { type: 'string' }, name: { type: 'string' } },
      required: ['name'],
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const rows = await db('categories')
        .where('playlist_id', playlistId)
        .andWhereRaw('name ILIKE ?', [`%${text(args.name, { field: 'name' })}%`])
        .orderBy('sort_order')
        .limit(50);
      return rows.map(compactCategory);
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
      const category = await categoryService.create(ctx.userId, args.playlistId || ctx.playlistId, text(args.name, { field: 'name' }));
      return compactCategory(category);
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
    run: (args, ctx) => categoryService.update(ctx.userId, args.categoryId, { name: text(args.name, { field: 'name' }) }),
  },

  rename_categories_bulk: {
    description: 'Kategori adlarında toplu bul-değiştir yapar.',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        find: { type: 'string' },
        replace: { type: 'string' },
      },
      required: ['find'],
    },
    run(args, ctx) {
      const find = text(args.find, { field: 'find', max: 200 });
      const replace = String(args.replace ?? '');
      return transformCategoryNames(ctx, args.playlistId || ctx.playlistId, (name) => name.split(find).join(replace));
    },
  },

  add_category_prefix: {
    description: 'Tüm kategori adlarının başına bir önek ekler (örn "TR | ").',
    parameters: {
      type: 'object',
      properties: { playlistId: { type: 'string' }, prefix: { type: 'string' } },
      required: ['prefix'],
    },
    run(args, ctx) {
      const prefix = text(args.prefix, { field: 'prefix', max: 100 });
      return transformCategoryNames(ctx, args.playlistId || ctx.playlistId, (name) => (name.startsWith(prefix) ? name : `${prefix}${name}`));
    },
  },

  add_category_suffix: {
    description: 'Tüm kategori adlarının sonuna bir sonek ekler.',
    parameters: {
      type: 'object',
      properties: { playlistId: { type: 'string' }, suffix: { type: 'string' } },
      required: ['suffix'],
    },
    run(args, ctx) {
      const suffix = text(args.suffix, { field: 'suffix', max: 100 });
      return transformCategoryNames(ctx, args.playlistId || ctx.playlistId, (name) => (name.endsWith(suffix) ? name : `${name}${suffix}`));
    },
  },

  normalize_category_names: {
    description: 'Kategori adlarını temizler: baş/son boşlukları atar, çoklu boşlukları teke indirir, isteğe bağlı olarak Baş Harfleri Büyütür.',
    parameters: {
      type: 'object',
      properties: { playlistId: { type: 'string' }, titleCase: { type: 'boolean' } },
    },
    run(args, ctx) {
      return transformCategoryNames(ctx, args.playlistId || ctx.playlistId, (name) => {
        const cleaned = name.replace(/\s+/g, ' ').trim();
        if (!args.titleCase) return cleaned;
        return cleaned.split(' ')
          .map((word) => word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1).toLocaleLowerCase('tr-TR'))
          .join(' ');
      });
    },
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

  set_categories_visibility: {
    description: 'Birden fazla kategoriyi tek çağrıda gizler veya görünür yapar.',
    parameters: {
      type: 'object',
      properties: {
        categoryIds: { type: 'array', items: { type: 'string' } },
        hidden: { type: 'boolean' },
      },
      required: ['categoryIds', 'hidden'],
    },
    async run(args, ctx) {
      const ids = idList(args.categoryIds, 500);
      let updated = 0;
      for (const id of ids) {
        await categoryService.update(ctx.userId, id, { is_hidden: args.hidden === true });
        updated++;
      }
      return { updated, hidden: args.hidden === true };
    },
  },

  show_all_categories: {
    description: 'Listedeki tüm gizli kategorileri yeniden görünür yapar.',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const updated = await db('categories').where({ playlist_id: playlistId, is_hidden: true }).update({ is_hidden: false });
      return { updated };
    },
  },

  list_hidden_categories: {
    description: 'Dışa aktarımlarda gizlenen kategorileri listeler.',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const rows = await db('categories').where({ playlist_id: playlistId, is_hidden: true }).orderBy('sort_order');
      return rows.map(compactCategory);
    },
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

  delete_category_with_channels: {
    description: 'Bir kategoriyi içindeki tüm kanallarla birlikte siler. Geri alınamaz.',
    destructive: true,
    parameters: { type: 'object', properties: { categoryId: { type: 'string' } }, required: ['categoryId'] },
    async run(args, ctx) {
      assertDestructive(ctx, 'delete_category_with_channels');
      const category = await ownedCategory(ctx.userId, args.categoryId);
      const deleted = await db('channels').where('category_id', category.id).del();
      await categoryService.delete(ctx.userId, category.id);
      return { deletedChannels: deleted, deletedCategory: category.name };
    },
  },

  delete_empty_categories: {
    description: 'Hiç kanalı olmayan kategorileri temizler.',
    destructive: true,
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
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

  merge_categories: {
    description: 'Kaynak kategorilerdeki kanalları hedef kategoriye taşır ve boşalan kaynak kategorileri siler.',
    destructive: true,
    parameters: {
      type: 'object',
      properties: {
        sourceCategoryIds: { type: 'array', items: { type: 'string' } },
        targetCategoryId: { type: 'string' },
      },
      required: ['sourceCategoryIds', 'targetCategoryId'],
    },
    async run(args, ctx) {
      assertDestructive(ctx, 'merge_categories');
      const target = await ownedCategory(ctx.userId, args.targetCategoryId);
      const sourceIds = idList(args.sourceCategoryIds, 200).filter((id) => id !== target.id);
      if (!sourceIds.length) throw createAppError('VALIDATION_ERROR', 'Hedeften farklı en az bir kaynak kategori gerekli');

      let moved = 0;
      for (const id of sourceIds) {
        const source = await ownedCategory(ctx.userId, id);
        if (source.playlist_id !== target.playlist_id) {
          throw createAppError('VALIDATION_ERROR', 'Kategoriler aynı oynatma listesinde olmalı');
        }
        moved += await db('channels').where('category_id', source.id).update({ category_id: target.id, updated_at: db.fn.now() });
        await categoryService.delete(ctx.userId, source.id);
      }
      return { moved, mergedInto: target.name, removedCategories: sourceIds.length };
    },
  },

  deduplicate_categories: {
    description: 'Aynı ada sahip kategorileri tek kategoride birleştirir (kanallar korunur).',
    destructive: true,
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    async run(args, ctx) {
      assertDestructive(ctx, 'deduplicate_categories');
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const rows = await db('categories').where('playlist_id', playlistId).orderBy('sort_order').select('id', 'name');

      const byName = new Map();
      let merged = 0;
      let moved = 0;
      for (const category of rows) {
        const key = category.name.toLocaleLowerCase('tr-TR');
        if (!byName.has(key)) { byName.set(key, category.id); continue; }
        moved += await db('channels').where('category_id', category.id).update({ category_id: byName.get(key), updated_at: db.fn.now() });
        await categoryService.delete(ctx.userId, category.id);
        merged++;
      }
      return { mergedCategories: merged, movedChannels: moved };
    },
  },

  split_category_by_pattern: {
    description: 'Bir kategorideki adı desene uyan kanalları yeni (veya var olan) bir kategoriye taşır.',
    parameters: {
      type: 'object',
      properties: {
        categoryId: { type: 'string', description: 'Kaynak kategori' },
        pattern: { type: 'string', description: 'Kanal adında aranan metin' },
        targetCategoryName: { type: 'string', description: 'Taşınacak kategorinin adı' },
        useRegex: { type: 'boolean' },
      },
      required: ['categoryId', 'pattern', 'targetCategoryName'],
    },
    async run(args, ctx) {
      const source = await ownedCategory(ctx.userId, args.categoryId);
      const pattern = text(args.pattern, { field: 'pattern', max: 200 });
      const name = text(args.targetCategoryName, { field: 'targetCategoryName' });

      let target = await db('categories').where({ playlist_id: source.playlist_id, name }).first();
      if (!target) target = await categoryService.create(ctx.userId, source.playlist_id, name);

      const query = db('channels').where('category_id', source.id);
      if (args.useRegex) query.andWhereRaw('name ~* ?', [pattern]);
      else query.andWhereRaw('name ILIKE ?', [`%${pattern}%`]);
      const moved = await query.update({ category_id: target.id, updated_at: db.fn.now() });
      return { moved, targetCategoryId: target.id, targetCategoryName: name };
    },
  },

  auto_categorize_channels: {
    description: 'Anahtar kelime → kategori eşlemesiyle kanalları otomatik kategorilere dağıtır. Kategoriler yoksa oluşturulur.',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        streamType: { type: 'string', enum: ['live', 'vod', 'series'] },
        onlyUncategorized: { type: 'boolean', description: 'Yalnızca kategorisiz kanallara uygula (varsayılan true)' },
        rules: {
          type: 'array',
          description: 'Her kural bir kategori adı ve anahtar kelimeler içerir',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              keywords: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
      required: ['rules'],
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      if (!Array.isArray(args.rules) || !args.rules.length) throw createAppError('VALIDATION_ERROR', 'En az bir kural gönderin');
      if (args.rules.length > 100) throw createAppError('VALIDATION_ERROR', 'En fazla 100 kural gönderilebilir');

      const existing = await db('categories').where('playlist_id', playlistId).select('id', 'name');
      const byName = new Map(existing.map((row) => [row.name.toLocaleLowerCase('tr-TR'), row.id]));
      const applied = [];

      for (const rule of args.rules) {
        const categoryName = text(rule?.category, { field: 'category' });
        const keywords = (Array.isArray(rule?.keywords) ? rule.keywords : [])
          .map((keyword) => String(keyword).trim())
          .filter(Boolean)
          .slice(0, 50);
        if (!keywords.length) continue;

        let categoryId = byName.get(categoryName.toLocaleLowerCase('tr-TR'));
        if (!categoryId) {
          const created = await categoryService.create(ctx.userId, playlistId, categoryName);
          categoryId = created.id;
          byName.set(categoryName.toLocaleLowerCase('tr-TR'), categoryId);
        }

        const query = db('channels').where('playlist_id', playlistId);
        if (args.streamType) query.andWhere('stream_type', args.streamType);
        if (args.onlyUncategorized !== false) query.whereNull('category_id');
        query.andWhere((builder) => {
          for (const keyword of keywords) builder.orWhereRaw('name ILIKE ?', [`%${keyword}%`]);
        });
        const moved = await query.update({ category_id: categoryId, updated_at: db.fn.now() });
        applied.push({ category: categoryName, moved });
      }
      return { rules: applied, totalMoved: applied.reduce((sum, item) => sum + item.moved, 0) };
    },
  },

  sort_categories: {
    description: 'Kategori sırasını topluca değiştirir: ada göre (A-Z / Z-A), kanal sayısına, oluşturulma zamanına veya verilen özel sıraya göre.',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        by: { type: 'string', enum: ['name', 'name_desc', 'channel_count', 'channel_count_asc', 'created', 'custom'] },
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

      const expression = CATEGORY_ORDERS[args.by];
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

  move_category_to_position: {
    description: 'Bir kategoriyi listede belirli bir sıraya taşır (0 = en üst).',
    parameters: {
      type: 'object',
      properties: { categoryId: { type: 'string' }, position: { type: 'integer' } },
      required: ['categoryId', 'position'],
    },
    async run(args, ctx) {
      const category = await ownedCategory(ctx.userId, args.categoryId);
      const rows = await db('categories').where('playlist_id', category.playlist_id).orderBy('sort_order').orderBy('id').select('id');
      const ids = rows.map((row) => row.id).filter((id) => id !== category.id);
      const position = Math.max(0, Math.min(Number(args.position) || 0, ids.length));
      ids.splice(position, 0, category.id);
      await db.raw(
        `UPDATE categories AS c SET sort_order = v.ord - 1
           FROM unnest(:order::uuid[]) WITH ORDINALITY AS v(id, ord)
          WHERE c.id = v.id AND c.playlist_id = :playlistId`,
        { order: ids, playlistId: category.playlist_id }
      );
      return { moved: category.name, position };
    },
  },

  category_stats: {
    description: 'Kategori başına kanal sayısı, logosuz ve EPG eşleşmesi olmayan kanal dağılımını verir.',
    parameters: {
      type: 'object',
      properties: { playlistId: { type: 'string' }, limit: { type: 'integer' } },
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const rows = await db.raw(`
        SELECT cat.id, cat.name, cat.is_hidden,
               COUNT(ch.id)::int AS channels,
               COUNT(*) FILTER (WHERE ch.logo_url IS NULL OR ch.logo_url = '')::int AS missing_logo,
               COUNT(*) FILTER (WHERE ch.epg_channel_id IS NULL OR ch.epg_channel_id = '')::int AS missing_epg
          FROM categories cat
          LEFT JOIN channels ch ON ch.category_id = cat.id
         WHERE cat.playlist_id = ?
         GROUP BY cat.id, cat.name, cat.is_hidden
         ORDER BY cat.sort_order
         LIMIT ?`, [playlistId, limitRows(args.limit, 100)]);
      return rows.rows;
    },
  },

  list_uncategorized_channels: {
    description: 'Hiçbir kategoriye ait olmayan kanalları listeler.',
    parameters: {
      type: 'object',
      properties: { playlistId: { type: 'string' }, limit: { type: 'integer' } },
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const limit = limitRows(args.limit, 50);
      const [{ count }] = await db('channels').where({ playlist_id: playlistId }).whereNull('category_id').count();
      const rows = await db('channels').where({ playlist_id: playlistId }).whereNull('category_id')
        .orderBy('sort_order').limit(limit).select('id', 'name', 'stream_type');
      return { total: Number(count), channels: rows };
    },
  },

  create_category_from_channels: {
    description: 'Seçilen kanalları yeni bir kategoriye toplar (kategoriyi oluşturur ve kanalları taşır).',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        name: { type: 'string' },
        channelIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['name', 'channelIds'],
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const ids = idList(args.channelIds, 5000);
      const owned = await db('channels').where('playlist_id', playlistId).whereIn('id', ids).count().first();
      if (Number(owned.count) !== ids.length) throw createAppError('NOT_FOUND', 'Kanallardan biri bu listeye ait değil');

      const category = await categoryService.create(ctx.userId, playlistId, text(args.name, { field: 'name' }));
      const moved = await db('channels').whereIn('id', ids).update({ category_id: category.id, updated_at: db.fn.now() });
      return { categoryId: category.id, name: category.name, moved };
    },
  },

  duplicate_category: {
    description: 'Bir kategorinin boş bir kopyasını aynı listede oluşturur. Bir kanal aynı listede iki kez bulunamayacağı için kanallar kopyalanmaz; kanalları taşımak için move_channels_to_category, başka listeye kopyalamak için copy_category_to_playlist kullanın.',
    parameters: {
      type: 'object',
      properties: { categoryId: { type: 'string' }, name: { type: 'string' } },
      required: ['categoryId', 'name'],
    },
    async run(args, ctx) {
      const source = await ownedCategory(ctx.userId, args.categoryId);
      const name = text(args.name, { field: 'name' });
      const [{ count }] = await db('channels').where('category_id', source.id).count();
      const category = await categoryService.create(ctx.userId, source.playlist_id, name);
      return {
        categoryId: category.id,
        name: category.name,
        copiedChannels: 0,
        sourceChannelCount: Number(count),
        note: 'Kanallar kopyalanmadı: aynı akış adresi bir listede yalnızca bir kez bulunabilir.',
      };
    },
  },
};
