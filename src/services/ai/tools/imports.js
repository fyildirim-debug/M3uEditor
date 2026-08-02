/** Ice aktarma, senkronizasyon ve saglayici kaynagi araclari. */

const {
  db, assertDestructive, ownedPlaylist, limitRows, text,
} = require('../helpers');
const config = require('../../../config');
const logger = require('../../../config/logger');
const { createAppError } = require('../../../utils/AppError');
const { safeFetchText } = require('../../../utils/safeFetch');
const ImportService = require('../../ImportService');
const XtreamClient = require('../../XtreamClient');
const PlaylistSourceService = require('../../PlaylistSourceService');
const FilterRuleService = require('../../FilterRuleService');

const importService = new ImportService();
const playlistSourceService = new PlaylistSourceService();
const filterRuleService = new FilterRuleService();

function credentials(args) {
  return {
    serverUrl: text(args.serverUrl, { field: 'serverUrl', max: 2048 }),
    username: text(args.username, { field: 'username', max: 500 }),
    password: text(args.password, { field: 'password', max: 500 }),
  };
}

module.exports = {
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
      const response = await safeFetchText(text(args.url, { field: 'url', max: 5000 }), {
        timeoutMs: 120_000,
        maxBytes: config.limits.m3uBytes,
        accept: 'audio/x-mpegurl,text/plain',
      });
      return importService.importFromM3U(ctx.userId, response.text, args.playlistId || null, args.playlistName, undefined);
    },
  },

  import_m3u_content: {
    description: 'Doğrudan yapıştırılan M3U metnini içe aktarır (küçük listeler için).',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '#EXTM3U ile başlayan içerik' },
        playlistId: { type: 'string' },
        playlistName: { type: 'string' },
      },
      required: ['content'],
    },
    async run(args, ctx) {
      if (args.playlistId) await ownedPlaylist(ctx.userId, args.playlistId);
      const content = String(args.content || '');
      if (!content.trim()) throw createAppError('VALIDATION_ERROR', 'M3U içeriği boş');
      if (Buffer.byteLength(content) > config.limits.m3uBytes) throw createAppError('VALIDATION_ERROR', 'M3U içeriği boyut sınırını aşıyor');
      return importService.importFromM3U(ctx.userId, content, args.playlistId || null, args.playlistName, undefined);
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
      return importService.importFromXtream(ctx.userId, {
        ...credentials(args),
        streamTypes: Array.isArray(args.streamTypes) && args.streamTypes.length ? args.streamTypes : ['live'],
        playlistName: args.playlistName,
      }, undefined, args.playlistId || undefined, undefined);
    },
  },

  import_xtream_categories: {
    description: 'Yalnızca seçilen Xtream kategorilerini içe aktarır. Kategori kimliklerini preview_xtream ile bulun.',
    parameters: {
      type: 'object',
      properties: {
        serverUrl: { type: 'string' },
        username: { type: 'string' },
        password: { type: 'string' },
        playlistId: { type: 'string' },
        live: { type: 'array', items: { type: 'string' }, description: 'Canlı kategori kimlikleri' },
        vod: { type: 'array', items: { type: 'string' } },
        series: { type: 'array', items: { type: 'string' } },
      },
      required: ['serverUrl', 'username', 'password'],
    },
    async run(args, ctx) {
      if (args.playlistId) await ownedPlaylist(ctx.userId, args.playlistId);
      const categories = {};
      for (const type of ['live', 'vod', 'series']) {
        if (Array.isArray(args[type]) && args[type].length) categories[type] = args[type].map(String);
      }
      if (!Object.keys(categories).length) throw createAppError('VALIDATION_ERROR', 'En az bir tür için kategori seçin');
      return importService.importFromXtream(ctx.userId, {
        ...credentials(args),
        streamTypes: Object.keys(categories),
        categories,
      }, undefined, args.playlistId || undefined, undefined, { categories });
    },
  },

  preview_xtream: {
    description: 'Xtream sunucusundaki kategori ve içerik türlerini içe aktarmadan önce önizler.',
    parameters: {
      type: 'object',
      properties: { serverUrl: { type: 'string' }, username: { type: 'string' }, password: { type: 'string' } },
      required: ['serverUrl', 'username', 'password'],
    },
    async run(args) {
      const { serverUrl, username, password } = credentials(args);
      const preview = await new XtreamClient(serverUrl, username, password).preview();
      const summary = {};
      for (const [type, categories] of Object.entries(preview.categories || {})) {
        summary[type] = { count: categories.length, sample: categories.slice(0, 30) };
      }
      return { ...preview, categories: summary };
    },
  },

  test_xtream_credentials: {
    description: 'Xtream sunucu bilgilerini doğrular ve hesap durumunu (bitiş tarihi, bağlantı sayısı) döndürür.',
    parameters: {
      type: 'object',
      properties: { serverUrl: { type: 'string' }, username: { type: 'string' }, password: { type: 'string' } },
      required: ['serverUrl', 'username', 'password'],
    },
    async run(args) {
      const { serverUrl, username, password } = credentials(args);
      try {
        const preview = await new XtreamClient(serverUrl, username, password).preview();
        return { ok: true, info: preview.userInfo || preview.user_info || null, types: Object.keys(preview.categories || {}) };
      } catch (error) {
        return { ok: false, error: error.message };
      }
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

  sync_all_playlists: {
    description: 'Xtream kaynağı tanımlı tüm listeleri sırayla günceller. Uzun sürebilir.',
    parameters: { type: 'object', properties: { limit: { type: 'integer', description: 'En fazla kaç liste güncellensin' } } },
    async run(args, ctx) {
      const playlists = await db('playlists').where('user_id', ctx.userId)
        .whereNotNull('xtream_password_enc')
        .orderBy('last_synced_at', 'asc')
        .limit(limitRows(args.limit, 10))
        .select('id', 'name');
      const results = [];
      for (const playlist of playlists) {
        try {
          const result = await importService.syncFromXtream(ctx.userId, playlist.id, undefined, undefined, {});
          results.push({ playlist: playlist.name, ok: true, channels: result.totalChannels ?? null });
        } catch (error) {
          results.push({ playlist: playlist.name, ok: false, error: error.message });
        }
      }
      return { synced: results.length, results };
    },
  },

  preview_sync: {
    description: 'Güncelleme öncesi sağlayıcıdaki kategorileri ve hangilerinin yeni olduğunu gösterir.',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const preview = await importService.previewSync(ctx.userId, playlistId);
      const summary = {};
      for (const [type, categories] of Object.entries(preview.categories || {})) {
        summary[type] = Array.isArray(categories) ? { count: categories.length, sample: categories.slice(0, 30) } : categories;
      }
      return { ...preview, categories: summary };
    },
  },

  add_stream_types: {
    description: 'Mevcut Xtream kimlik bilgileriyle listeye yeni içerik türleri (film/dizi) ekler.',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        streamTypes: { type: 'array', items: { type: 'string', enum: ['live', 'vod', 'series'] } },
      },
      required: ['streamTypes'],
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      if (!Array.isArray(args.streamTypes) || !args.streamTypes.length) {
        throw createAppError('VALIDATION_ERROR', 'En az bir içerik türü seçin');
      }
      return importService.addStreamTypes(ctx.userId, playlistId, args.streamTypes, undefined);
    },
  },

  get_active_jobs: {
    description: 'Süren içe aktarma/senkronizasyon işlerinin ilerlemesini gösterir.',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    async run(args, ctx) {
      // Is kaydi bellekte tutuldugu icin kalici ilerleme playlist satirindan okunur.
      const playlistId = args.playlistId || ctx.playlistId;
      if (!playlistId) {
        const rows = await db('playlists').where('user_id', ctx.userId)
          .orderBy('last_synced_at', 'desc').limit(10).select('id', 'name', 'last_synced_at');
        return { playlists: rows };
      }
      const playlist = await ownedPlaylist(ctx.userId, playlistId);
      const [{ count }] = await db('channels').where('playlist_id', playlist.id).count();
      return { playlistId: playlist.id, name: playlist.name, channelCount: Number(count), lastSyncedAt: playlist.last_synced_at };
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
      ...credentials(args), label: args.label,
    }),
  },

  remove_playlist_source: {
    description: 'Ek bir Xtream kaynağını listeden çıkarır (kanallar kalır).',
    destructive: true,
    parameters: { type: 'object', properties: { sourceId: { type: 'string' } }, required: ['sourceId'] },
    async run(args, ctx) {
      assertDestructive(ctx, 'remove_playlist_source');
      await playlistSourceService.remove(ctx.userId, args.sourceId);
      return { removed: true };
    },
  },

  list_filter_rules: {
    description: 'İçe aktarım sırasında uygulanan filtre kurallarını listeler.',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    run: (args, ctx) => filterRuleService.list(ctx.userId, args.playlistId || ctx.playlistId),
  },

  create_filter_rule: {
    description: 'İçe aktarım filtre kuralı ekler: eşleşen kanalları dışarıda bırakır (exclude=true) veya yalnızca eşleşenleri alır.',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        field: { type: 'string', description: 'Kuralın uygulanacağı alan, örn name veya category' },
        pattern: { type: 'string' },
        exclude: { type: 'boolean' },
        enabled: { type: 'boolean' },
      },
      required: ['field', 'pattern'],
    },
    run: (args, ctx) => filterRuleService.create(ctx.userId, args.playlistId || ctx.playlistId, {
      field: args.field, pattern: args.pattern, exclude: args.exclude, enabled: args.enabled,
    }),
  },

  update_filter_rule: {
    description: 'Bir filtre kuralının desenini, alanını veya etkinliğini değiştirir.',
    parameters: {
      type: 'object',
      properties: {
        ruleId: { type: 'string' },
        field: { type: 'string' },
        pattern: { type: 'string' },
        exclude: { type: 'boolean' },
        enabled: { type: 'boolean' },
      },
      required: ['ruleId'],
    },
    run: (args, ctx) => filterRuleService.update(ctx.userId, args.ruleId, {
      field: args.field, pattern: args.pattern, exclude: args.exclude, enabled: args.enabled,
    }),
  },

  test_filter_rule: {
    description: 'Bir filtre desenini yazmadan önce mevcut kanallar üzerinde dener.',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        field: { type: 'string' },
        pattern: { type: 'string' },
      },
      required: ['field', 'pattern'],
    },
    run: (args, ctx) => filterRuleService.testPattern(ctx.userId, args.playlistId || ctx.playlistId, {
      field: args.field, pattern: args.pattern,
    }, 10),
  },

  move_filter_rule: {
    description: 'Bir filtre kuralını sırada yukarı veya aşağı taşır.',
    parameters: {
      type: 'object',
      properties: { ruleId: { type: 'string' }, direction: { type: 'string', enum: ['up', 'down'] } },
      required: ['ruleId', 'direction'],
    },
    run: (args, ctx) => filterRuleService.move(ctx.userId, args.ruleId, args.direction),
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

  schedule_epg_after_import: {
    description: 'Xtream sağlayıcısının kendi XMLTV rehberini EPG kaynağı olarak ekler (xmltv.php).',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    async run(args, ctx) {
      const playlist = await ownedPlaylist(ctx.userId, args.playlistId || ctx.playlistId);
      if (!playlist.xtream_server_url || !playlist.xtream_username) {
        throw createAppError('VALIDATION_ERROR', 'Bu listede kayıtlı Xtream kaynağı yok');
      }
      const { decrypt } = require('../../../utils/crypto');
      const password = playlist.xtream_password_enc ? decrypt(playlist.xtream_password_enc) : '';
      const url = `${playlist.xtream_server_url.replace(/\/+$/, '')}/xmltv.php?username=${encodeURIComponent(playlist.xtream_username)}&password=${encodeURIComponent(password)}`;
      const EPGService = require('../../EPGService');
      const epgService = new EPGService();
      const source = await epgService.addSource(ctx.userId, url);
      epgService.enqueueSource(ctx.userId, url, playlist.id)
        .catch((error) => logger.warn({ err: error }, 'AI provider EPG import failed'));
      return { sourceId: source.id, status: 'processing' };
    },
  },
};
