/** EPG (XMLTV rehber) araclari. */

const {
  db, assertDestructive, ownedPlaylist, ownedChannel, idList, limitRows, text, resolveChannelIds,
} = require('../helpers');
const { createAppError } = require('../../../utils/AppError');
const logger = require('../../../config/logger');
const { removeChannelLogos } = require('../../../utils/logoStorage');
const EPGService = require('../../EPGService');
const EpgLibraryService = require('../../EpgLibraryService');
const xmltvExportService = require('../../XMLTVExportService');

const epgService = new EPGService();
const epgLibraryService = new EpgLibraryService();

async function ownedEpgSource(userId, sourceId) {
  const source = await db('epg_sources').where({ id: sourceId, user_id: userId }).first();
  if (!source) throw createAppError('NOT_FOUND', 'EPG kaynağı bulunamadı');
  return source;
}

/** Eslesmis rehber ikonlarini kanallara uygular. */
async function applyLogos(userId, playlistId, { overwrite, channelIds }) {
  const bindings = { playlistId, userId };
  let idClause = '';
  if (channelIds) { idClause = 'AND c.id = ANY(:channelIds::uuid[])'; bindings.channelIds = channelIds; }

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
          ${idClause}
          ${overwrite ? '' : "AND (c.logo_url IS NULL OR c.logo_url = '')"}
        ORDER BY c.id, (c.epg_source_id = e.source_id) DESC, e.source_id
     ),
     updated AS (
       UPDATE channels AS ch SET logo_url = t.icon_url, updated_at = NOW()
         FROM targets t WHERE ch.id = t.id RETURNING ch.id
     )
     SELECT id, previous_logo FROM targets`,
    bindings
  );
  const orphaned = result.rows.filter((row) => typeof row.previous_logo === 'string' && row.previous_logo.startsWith('/logos/'));
  if (orphaned.length) await removeChannelLogos(orphaned.map((row) => row.id));
  return result.rows.length;
}

module.exports = {
  list_epg_sources: {
    description: 'Hesaptaki XMLTV/EPG kaynaklarını durum ve son güncelleme zamanıyla listeler. Durumlar: pending, processing, active, error.',
    parameters: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['pending', 'processing', 'active', 'error'] } },
    },
    async run(args, ctx) {
      const sources = await epgService.listSources(ctx.userId);
      return args.status ? sources.filter((source) => source.status === args.status) : sources;
    },
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

  add_epg_source_from_library: {
    description: 'iptv-org kütüphanesindeki bir rehberi (site adıyla) EPG kaynağı olarak ekler.',
    parameters: {
      type: 'object',
      properties: { site: { type: 'string', description: 'search_epg_library sonucundaki site alanı' }, playlistId: { type: 'string' } },
      required: ['site'],
    },
    async run(args, ctx) {
      const url = await epgLibraryService.resolveGuide(args.site);
      const source = await epgService.addSource(ctx.userId, url);
      epgService.enqueueSource(ctx.userId, url, args.playlistId || ctx.playlistId || undefined)
        .catch((error) => logger.warn({ err: error, userId: ctx.userId }, 'AI EPG library import failed'));
      return { sourceId: source.id, site: args.site, status: 'processing' };
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
      await ownedEpgSource(ctx.userId, args.sourceId);
      epgService.refreshSource(ctx.userId, args.sourceId, { force: args.force === true })
        .catch((error) => logger.warn({ err: error, sourceId: args.sourceId }, 'AI EPG refresh failed'));
      return { sourceId: args.sourceId, status: 'processing' };
    },
  },

  refresh_all_epg_sources: {
    description: 'Hesaptaki tüm EPG kaynaklarını arka planda yeniler.',
    parameters: { type: 'object', properties: { onlyStale: { type: 'boolean', description: 'Yalnızca hata almış veya hiç indirilmemiş kaynaklar' } } },
    async run(args, ctx) {
      const sources = await db('epg_sources').where('user_id', ctx.userId).select('id', 'status', 'last_fetched_at');
      const targets = args.onlyStale
        ? sources.filter((source) => source.status === 'error' || !source.last_fetched_at)
        : sources;
      for (const source of targets) {
        epgService.refreshSource(ctx.userId, source.id, {})
          .catch((error) => logger.warn({ err: error, sourceId: source.id }, 'AI EPG bulk refresh failed'));
      }
      return { started: targets.length };
    },
  },

  set_epg_refresh_interval: {
    description: 'Bir EPG kaynağının otomatik yenileme aralığını (dakika) ayarlar. 0 kapatır.',
    parameters: {
      type: 'object',
      properties: { sourceId: { type: 'string' }, minutes: { type: 'integer' } },
      required: ['sourceId', 'minutes'],
    },
    run(args, ctx) {
      const minutes = Number(args.minutes) > 0 ? Math.trunc(Number(args.minutes)) : null;
      return epgService.updateRefreshSettings(ctx.userId, args.sourceId, minutes);
    },
  },

  delete_epg_source: {
    description: 'Bir EPG kaynağını ve rehber verisini siler.',
    destructive: true,
    parameters: { type: 'object', properties: { sourceId: { type: 'string' } }, required: ['sourceId'] },
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
      return { updated: await applyLogos(ctx.userId, playlistId, { overwrite }), overwrite };
    },
  },

  apply_epg_logos_to_channels: {
    description: 'Rehber ikonlarını yalnızca seçilen kanallara uygular.',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        channelIds: { type: 'array', items: { type: 'string' } },
        search: { type: 'string' },
        categoryId: { type: 'string' },
        overwrite: { type: 'boolean' },
      },
    },
    async run(args, ctx) {
      const ids = await resolveChannelIds(ctx, args, { max: 5000 });
      const playlistId = args.playlistId || ctx.playlistId || (await ownedChannel(ctx.userId, ids[0])).playlist_id;
      await ownedPlaylist(ctx.userId, playlistId);
      const overwrite = args.overwrite === true;
      if (overwrite) assertDestructive(ctx, 'apply_epg_logos_to_channels(overwrite)');
      return { updated: await applyLogos(ctx.userId, playlistId, { overwrite, channelIds: ids }) };
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

  list_epg_channels: {
    description: 'Bir EPG kaynağındaki rehber kanallarını listeler.',
    parameters: {
      type: 'object',
      properties: { sourceId: { type: 'string' }, search: { type: 'string' }, limit: { type: 'integer' } },
      required: ['sourceId'],
    },
    async run(args, ctx) {
      await ownedEpgSource(ctx.userId, args.sourceId);
      const query = db('epg_channels').where('source_id', args.sourceId);
      if (args.search) query.andWhereRaw('display_name ILIKE ?', [`%${args.search}%`]);
      const [{ count }] = await query.clone().count();
      const rows = await query.select('channel_id', 'display_name', 'icon_url').orderBy('display_name').limit(limitRows(args.limit, 50));
      return { total: Number(count), channels: rows };
    },
  },

  assign_epg_to_channel: {
    description: 'Belirli bir kanala EPG (tvg-id) kimliği atar veya boş metinle kaldırır.',
    parameters: {
      type: 'object',
      properties: {
        channelId: { type: 'string' },
        epgChannelId: { type: 'string', description: 'Boş metin gönderilirse eşleşme kaldırılır' },
      },
      required: ['channelId'],
    },
    async run(args, ctx) {
      const channel = await ownedChannel(ctx.userId, args.channelId);
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
      const [updated] = await db('channels').where({ id: channel.id }).update({
        epg_channel_id: args.epgChannelId ? String(args.epgChannelId).trim() : null,
        epg_source_id: sourceId,
        updated_at: db.fn.now(),
      }).returning('*');
      return { id: updated.id, name: updated.name, epgChannelId: updated.epg_channel_id };
    },
  },

  clear_epg_matches: {
    description: 'Bir listedeki tüm EPG eşleşmelerini kaldırır (yeniden eşleştirmeden önce temiz başlangıç).',
    destructive: true,
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    async run(args, ctx) {
      assertDestructive(ctx, 'clear_epg_matches');
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const updated = await db('channels').where('playlist_id', playlistId)
        .update({ epg_channel_id: null, epg_source_id: null, updated_at: db.fn.now() });
      return { cleared: updated };
    },
  },

  list_unmatched_channels: {
    description: 'EPG eşleşmesi olmayan kanalları listeler.',
    parameters: {
      type: 'object',
      properties: { playlistId: { type: 'string' }, limit: { type: 'integer' } },
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const base = db('channels').where('playlist_id', playlistId)
        .andWhere((builder) => builder.whereNull('epg_channel_id').orWhere('epg_channel_id', ''));
      const [{ count }] = await base.clone().count();
      const rows = await base.select('id', 'name', 'stream_type').orderBy('sort_order').limit(limitRows(args.limit, 50));
      return { total: Number(count), channels: rows };
    },
  },

  suggest_epg_matches: {
    description: 'Eşleşmemiş kanallar için rehberden aday tvg-id önerileri getirir (yazmaz, yalnızca önerir).',
    parameters: {
      type: 'object',
      properties: { playlistId: { type: 'string' }, limit: { type: 'integer' } },
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const channels = await db('channels').where('playlist_id', playlistId)
        .andWhere((builder) => builder.whereNull('epg_channel_id').orWhere('epg_channel_id', ''))
        .orderBy('sort_order').limit(limitRows(args.limit, 20)).select('id', 'name');

      const suggestions = [];
      for (const channel of channels) {
        const candidates = await epgService.searchEpgChannels(ctx.userId, channel.name, 3);
        suggestions.push({ channelId: channel.id, channelName: channel.name, candidates });
      }
      return suggestions;
    },
  },

  get_epg_coverage: {
    description: 'Kaç kanalın EPG eşleşmesi olduğunu ve rehber kapsamını özetler.',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      return xmltvExportService.getCoverage(ctx.userId, playlistId);
    },
  },

  get_channel_programs: {
    description: 'Bir kanalın belirli bir gündeki yayın akışını verir.',
    parameters: {
      type: 'object',
      properties: {
        channelId: { type: 'string' },
        date: { type: 'string', description: 'YYYY-AA-GG, boşsa bugün' },
        limit: { type: 'integer' },
      },
      required: ['channelId'],
    },
    async run(args, ctx) {
      const programs = await epgService.getPreview(ctx.userId, args.channelId, args.date, 0);
      return programs.slice(0, limitRows(args.limit, 50)).map((program) => ({
        title: program.title,
        start: program.start_time,
        end: program.end_time,
      }));
    },
  },

  get_now_playing: {
    description: 'Bir listedeki kanallarda şu anda yayında olan programları gösterir.',
    parameters: {
      type: 'object',
      properties: { playlistId: { type: 'string' }, limit: { type: 'integer' } },
    },
    async run(args, ctx) {
      const playlistId = args.playlistId || ctx.playlistId;
      await ownedPlaylist(ctx.userId, playlistId);
      const result = await db.raw(`
        SELECT c.id, c.name, p.title, p.start_time, p.end_time
          FROM channels c
          JOIN epg_channels e ON e.channel_id = c.epg_channel_id
                             AND (c.epg_source_id IS NULL OR c.epg_source_id = e.source_id)
          JOIN epg_sources s ON s.id = e.source_id AND s.user_id = :userId
          JOIN epg_programs p ON p.epg_channel_id = e.id
         WHERE c.playlist_id = :playlistId
           AND p.start_time <= NOW() AND (p.end_time IS NULL OR p.end_time > NOW())
         ORDER BY c.sort_order
         LIMIT :limit`, { playlistId, userId: ctx.userId, limit: limitRows(args.limit, 50) });
      return result.rows;
    },
  },

  search_epg_library: {
    description: 'iptv-org EPG kütüphanesinde ülke/dil/anahtar kelimeye göre hazır XMLTV kaynakları arar.',
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

  list_epg_library_countries: {
    description: 'EPG kütüphanesinde rehber bulunan ülkeleri listeler.',
    parameters: { type: 'object', properties: { search: { type: 'string' } } },
    async run(args) {
      const countries = await epgLibraryService.listCountries();
      if (!args.search) return countries;
      const needle = String(args.search).toLocaleLowerCase('tr-TR');
      return countries.filter((country) => JSON.stringify(country).toLocaleLowerCase('tr-TR').includes(needle));
    },
  },

  list_epg_profiles: {
    description: 'Bir listedeki kayıtlı EPG eşleştirme profillerini listeler.',
    parameters: { type: 'object', properties: { playlistId: { type: 'string' } } },
    run: (args, ctx) => epgService.listProfiles(ctx.userId, args.playlistId || ctx.playlistId),
  },

  save_epg_profile: {
    description: 'Eşleştirme ayarlarını (atılacak ön ek/son ek/yok sayılacak kelimeler) profil olarak kaydeder.',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        name: { type: 'string' },
        stripPrefixes: { type: 'array', items: { type: 'string' } },
        stripSuffixes: { type: 'array', items: { type: 'string' } },
        ignoreWords: { type: 'array', items: { type: 'string' } },
      },
      required: ['name'],
    },
    run: (args, ctx) => epgService.saveProfile(ctx.userId, args.playlistId || ctx.playlistId, {
      name: text(args.name, { field: 'name', max: 200 }),
      settings: {
        stripPrefixes: args.stripPrefixes || [],
        stripSuffixes: args.stripSuffixes || [],
        ignoreWords: args.ignoreWords || [],
      },
    }),
  },

  run_epg_profile: {
    description: 'Kayıtlı bir EPG eşleştirme profilini çalıştırır.',
    parameters: { type: 'object', properties: { profileId: { type: 'string' } }, required: ['profileId'] },
    run: (args, ctx) => epgService.runProfile(ctx.userId, args.profileId),
  },

  delete_epg_profile: {
    description: 'Bir EPG eşleştirme profilini siler.',
    destructive: true,
    parameters: { type: 'object', properties: { profileId: { type: 'string' } }, required: ['profileId'] },
    async run(args, ctx) {
      assertDestructive(ctx, 'delete_epg_profile');
      await epgService.deleteProfile(ctx.userId, args.profileId);
      return { deleted: true };
    },
  },

  copy_epg_matches: {
    description: 'Bir listedeki EPG eşleşmelerini, kanal adları eşleşen başka bir listeye kopyalar.',
    parameters: {
      type: 'object',
      properties: { sourcePlaylistId: { type: 'string' }, targetPlaylistId: { type: 'string' } },
      required: ['sourcePlaylistId', 'targetPlaylistId'],
    },
    async run(args, ctx) {
      await ownedPlaylist(ctx.userId, args.sourcePlaylistId);
      await ownedPlaylist(ctx.userId, args.targetPlaylistId);
      const result = await db.raw(
        `UPDATE channels AS target
            SET epg_channel_id = source.epg_channel_id,
                epg_source_id = source.epg_source_id,
                updated_at = NOW()
           FROM (
             SELECT DISTINCT ON (lower(name)) lower(name) AS key, epg_channel_id, epg_source_id
               FROM channels
              WHERE playlist_id = :source AND epg_channel_id IS NOT NULL AND epg_channel_id <> ''
           ) AS source
          WHERE target.playlist_id = :target
            AND lower(target.name) = source.key
            AND target.epg_channel_id IS DISTINCT FROM source.epg_channel_id
          RETURNING target.id`,
        { source: args.sourcePlaylistId, target: args.targetPlaylistId }
      );
      return { copied: result.rows.length };
    },
  },

  list_epg_source_stats: {
    description: 'Her EPG kaynağındaki rehber kanalı ve program sayısını verir.',
    parameters: {
      type: 'object',
      properties: { sourceId: { type: 'string', description: 'Yalnızca bu kaynak' } },
    },
    async run(args, ctx) {
      if (args.sourceId) await ownedEpgSource(ctx.userId, args.sourceId);
      const result = await db.raw(`
        SELECT s.id, s.status, s.last_fetched_at,
               COUNT(DISTINCT e.id)::int AS channels,
               COUNT(p.id)::int AS programs
          FROM epg_sources s
          LEFT JOIN epg_channels e ON e.source_id = s.id
          LEFT JOIN epg_programs p ON p.epg_channel_id = e.id
         WHERE s.user_id = :userId
           AND (:sourceId::uuid IS NULL OR s.id = :sourceId::uuid)
         GROUP BY s.id, s.status, s.last_fetched_at
         ORDER BY s.created_at`, { userId: ctx.userId, sourceId: args.sourceId || null });
      return result.rows;
    },
  },

  match_epg_for_channels: {
    description: 'Seçilen kanallar için rehberde en iyi eşleşmeyi bulup atar (tüm listeyi değil, yalnızca seçimi etkiler).',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        channelIds: { type: 'array', items: { type: 'string' } },
        search: { type: 'string' },
        categoryId: { type: 'string' },
      },
    },
    async run(args, ctx) {
      const ids = await resolveChannelIds(ctx, args, { max: 200 });
      const channels = await db('channels').whereIn('id', ids).select('id', 'name');
      let matched = 0;
      for (const channel of channels) {
        const [best] = await epgService.searchEpgChannels(ctx.userId, channel.name, 1);
        if (!best?.channel_id) continue;
        await db('channels').where('id', channel.id).update({
          epg_channel_id: best.channel_id,
          epg_source_id: best.source_id || null,
          updated_at: db.fn.now(),
        });
        matched++;
      }
      return { matched, total: channels.length };
    },
  },

  bulk_assign_epg_ids: {
    description: 'Kanal kimliği → tvg-id eşlemelerini toplu uygular (elle düzeltmeler için).',
    parameters: {
      type: 'object',
      properties: {
        assignments: {
          type: 'array',
          items: {
            type: 'object',
            properties: { channelId: { type: 'string' }, epgChannelId: { type: 'string' } },
          },
        },
      },
      required: ['assignments'],
    },
    async run(args, ctx) {
      const assignments = Array.isArray(args.assignments) ? args.assignments.slice(0, 500) : [];
      if (!assignments.length) throw createAppError('VALIDATION_ERROR', 'En az bir eşleme gönderin');
      const ids = idList(assignments.map((item) => item?.channelId), 500);
      const owned = await db('channels')
        .join('playlists', 'channels.playlist_id', 'playlists.id')
        .whereIn('channels.id', ids)
        .andWhere('playlists.user_id', ctx.userId)
        .count('channels.id as count')
        .first();
      if (Number(owned.count) !== ids.length) throw createAppError('NOT_FOUND', 'Kanallardan biri hesabınıza ait değil');

      let updated = 0;
      await db.transaction(async (trx) => {
        for (const item of assignments) {
          if (!item?.channelId) continue;
          const epgChannelId = item.epgChannelId ? String(item.epgChannelId).trim() : null;
          let sourceId = null;
          if (epgChannelId) {
            const match = await trx('epg_channels')
              .join('epg_sources', 'epg_channels.source_id', 'epg_sources.id')
              .where({ 'epg_channels.channel_id': epgChannelId, 'epg_sources.user_id': ctx.userId })
              .select('epg_channels.source_id')
              .first();
            sourceId = match?.source_id || null;
          }
          updated += await trx('channels').where('id', item.channelId)
            .update({ epg_channel_id: epgChannelId, epg_source_id: sourceId, updated_at: trx.fn.now() });
        }
      });
      return { updated };
    },
  },
};
