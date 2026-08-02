/** Disa aktarma, paylasim, Xtream cikisi ve gorunum araclari. */

const {
  db, assertDestructive, ownedPlaylist, idList, limitRows, text, compactChannel,
} = require('../helpers');
const config = require('../../../config');
const { createAppError } = require('../../../utils/AppError');
const exportService = require('../../ExportService');
const xmltvExportService = require('../../XMLTVExportService');
const xtreamOutputService = require('../../XtreamOutputService');
const viewService = require('../../ViewService');

module.exports = {
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

  get_export_urls: {
    description: 'Bir listenin M3U ve XMLTV indirme adreslerini verir.',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    async run(args, ctx) {
      const playlist = await ownedPlaylist(ctx.userId, args.playlistId || ctx.playlistId);
      return {
        m3u: `${config.appUrl}/api/playlists/${playlist.id}/export`,
        xmltv: `${config.appUrl}/api/playlists/${playlist.id}/xmltv`,
        note: 'Bu adresler oturum açmış kullanıcı içindir; herkese açık bağlantı için share_playlist kullanın.',
      };
    },
  },

  export_channels_as_json: {
    description: 'Kanalları yapılandırılmış veri olarak döndürür (rapor veya doğrulama için, en fazla 200 satır).',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        streamType: { type: 'string', enum: ['live', 'vod', 'series'] },
        categoryId: { type: 'string' },
        limit: { type: 'integer' },
      },
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const query = db('channels')
        .leftJoin('categories', 'channels.category_id', 'categories.id')
        .where('channels.playlist_id', playlistId)
        .select('channels.*', 'categories.name as category_name')
        .orderBy('channels.sort_order')
        .limit(limitRows(args.limit, 100));
      if (args.streamType) query.andWhere('channels.stream_type', args.streamType);
      if (args.categoryId) query.andWhere('channels.category_id', args.categoryId);
      const rows = await query;
      return rows.map(compactChannel);
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

  get_share_status: {
    description: 'Bir listenin paylaşım durumunu (aktif mi, süresi, şifreli mi) gösterir.',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    async run(args, ctx) {
      const playlist = await ownedPlaylist(ctx.userId, args.playlistId || ctx.playlistId);
      return {
        shared: Boolean(playlist.share_token),
        expiresAt: playlist.share_expires_at,
        passwordProtected: Boolean(playlist.share_password),
        note: playlist.share_token ? 'Bağlantı yalnızca oluşturulduğu anda gösterilir; yenilemek için share_playlist çağırın.' : undefined,
      };
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

  list_shared_playlists: {
    description: 'Herkese açık bağlantısı olan listeleri gösterir.',
    parameters: {
      type: 'object',
      properties: { includeExpired: { type: 'boolean', description: 'Süresi dolmuş paylaşımları da göster' } },
    },
    async run(args, ctx) {
      const query = db('playlists').where('user_id', ctx.userId).whereNotNull('share_token')
        .select('id', 'name', 'share_expires_at')
        .orderBy('name');
      if (!args.includeExpired) {
        query.andWhere((builder) => builder.whereNull('share_expires_at').orWhere('share_expires_at', '>', db.fn.now()));
      }
      const rows = await query;
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        expiresAt: row.share_expires_at,
      }));
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

  regenerate_xtream_output_password: {
    description: 'Xtream çıkışının şifresini yeniler; eski şifre anında geçersiz olur.',
    destructive: true,
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    async run(args, ctx) {
      assertDestructive(ctx, 'regenerate_xtream_output_password');
      return xtreamOutputService.regenerate(ctx.userId, args.playlistId || ctx.playlistId);
    },
  },

  disable_xtream_output: {
    description: 'Xtream Codes çıkışını kapatır.',
    destructive: true,
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    async run(args, ctx) {
      assertDestructive(ctx, 'disable_xtream_output');
      return xtreamOutputService.disable(ctx.userId, args.playlistId || ctx.playlistId);
    },
  },

  export_xmltv_coverage: {
    description: 'XMLTV çıktısının kaç kanalı ve kaç programı kapsadığını raporlar.',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      return xmltvExportService.getCoverage(ctx.userId, playlistId);
    },
  },

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
      name: text(args.name, { field: 'name', max: 200 }),
      hiddenCategoryIds: args.hiddenCategoryIds || [],
    }),
  },

  update_view: {
    description: 'Bir görünüm profilinin adını veya gizlenen kategorilerini değiştirir.',
    parameters: {
      type: 'object',
      properties: {
        viewId: { type: 'string' },
        name: { type: 'string' },
        hiddenCategoryIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['viewId'],
    },
    run: (args, ctx) => viewService.update(ctx.userId, args.viewId, {
      name: args.name,
      hiddenCategoryIds: args.hiddenCategoryIds,
    }),
  },

  delete_view: {
    description: 'Bir görünüm profilini siler.',
    destructive: true,
    parameters: { type: 'object', properties: { viewId: { type: 'string' } }, required: ['viewId'] },
    async run(args, ctx) {
      assertDestructive(ctx, 'delete_view');
      await viewService.remove(ctx.userId, args.viewId);
      return { deleted: true };
    },
  },

  export_view_as_m3u_preview: {
    description: 'Bir görünüm profiline göre üretilecek M3U çıktısını önizler.',
    parameters: {
      type: 'object',
      properties: { playlistId: { type: 'string' }, viewId: { type: 'string' }, lines: { type: 'integer' } },
      required: ['viewId'],
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      const content = await exportService.exportAsM3U(ctx.userId, playlistId, [], null, args.viewId);
      const lines = Math.min(Math.max(Number(args.lines) || 20, 1), 100);
      return { bytes: Buffer.byteLength(content, 'utf8'), preview: content.split('\n').slice(0, lines).join('\n') };
    },
  },

  create_view_from_categories: {
    description: 'Verilen kategoriler DIŞINDAKİ her şeyi gizleyen bir görünüm oluşturur (yalnızca bunları göster).',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        name: { type: 'string' },
        visibleCategoryIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['name', 'visibleCategoryIds'],
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const visible = new Set(idList(args.visibleCategoryIds, 2000));
      const all = await db('categories').where('playlist_id', playlistId).select('id');
      const hidden = all.map((row) => row.id).filter((id) => !visible.has(id));
      if (!hidden.length) throw createAppError('VALIDATION_ERROR', 'Gizlenecek kategori kalmıyor');
      return viewService.create(ctx.userId, playlistId, {
        name: text(args.name, { field: 'name', max: 200 }),
        hiddenCategoryIds: hidden,
      });
    },
  },
};
