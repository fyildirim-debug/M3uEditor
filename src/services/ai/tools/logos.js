/**
 * Hazir logo kutuphanesi (tv-logo/tv-logos) araclari.
 *
 * Kanallarin logosu ya saglayicidan gelir, ya EPG rehberinden alinir, ya da
 * buradaki 10 binden fazla hazir logodan secilir. Asistan tek kanal icin
 * arama yapabildigi gibi, logosu olmayan kanallari toplu olarak da
 * eslestirebilir.
 */

const {
  db, assertDestructive, ownedPlaylist, ownedChannel, resolveChannelIds, limitRows, text,
} = require('../helpers');
const logoLibrary = require('../../LogoLibraryService');

module.exports = {
  search_logo_library: {
    description: 'Hazır logo kütüphanesinde (tv-logo/tv-logos, 10.000+ kanal logosu) arama yapar. Kanal adını verin, eşleşen logoların adını, ülkesini ve adresini döndürür.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Aranacak kanal adı' },
        group: { type: 'string', description: 'Ülke/grup filtresi (ör. turkey, united-kingdom, vod)' },
        limit: { type: 'integer' },
      },
      required: ['query'],
    },
    async run(args) {
      const result = await logoLibrary.search({
        q: text(args.query, { field: 'query', max: 200 }),
        group: args.group,
        limit: limitRows(args.limit, 15),
      });
      return {
        total: result.total,
        logos: result.logos.map((logo) => ({ name: logo.name, group: logo.group, url: logo.url })),
      };
    },
  },

  list_logo_library_groups: {
    description: 'Hazır logo kütüphanesindeki ülke/grup listesini ve her birindeki logo sayısını verir.',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'integer' } },
    },
    async run(args) {
      const { total, groups } = await logoLibrary.listGroups();
      return { total, groups: groups.slice(0, limitRows(args.limit, 80)) };
    },
  },

  set_channel_logo_from_library: {
    description: 'Bir kanala hazır kütüphaneden logo atar. logoUrl verilirse o kullanılır; verilmezse kanalın adıyla en iyi eşleşme aranır ve bulunamazsa hata döner (yanlış logo atanmaz).',
    parameters: {
      type: 'object',
      properties: {
        channelId: { type: 'string' },
        logoUrl: { type: 'string', description: 'search_logo_library sonucundaki adres' },
        group: { type: 'string', description: 'Otomatik eşleştirmede ülke/grup sınırı' },
      },
      required: ['channelId'],
    },
    async run(args, ctx) {
      const channel = await ownedChannel(ctx.userId, String(args.channelId).trim());
      let url = args.logoUrl ? String(args.logoUrl).trim() : '';
      let matchedName = null;

      if (!url) {
        const match = await logoLibrary.bestMatch(channel.name, { group: args.group });
        if (!match) {
          return { updated: 0, reason: `"${channel.name}" için yeterince benzer bir logo bulunamadı. search_logo_library ile arayıp logoUrl verin.` };
        }
        url = match.url;
        matchedName = match.name;
      }

      await db('channels').where({ id: channel.id }).update({ logo_url: url, updated_at: db.fn.now() });
      return { updated: 1, channel: channel.name, logo: matchedName, logoUrl: url };
    },
  },

  apply_library_logos: {
    description: 'Seçilen kanallara hazır kütüphaneden logo bulup uygular. Varsayılan olarak yalnızca logosu olmayan kanallara dokunur; overwrite=true mevcut logoların üzerine yazar. Emin olunamayan kanallar atlanır ve raporlanır.',
    parameters: {
      type: 'object',
      properties: {
        playlistId: { type: 'string' },
        channelIds: { type: 'array', items: { type: 'string' } },
        categoryId: { type: 'string' },
        search: { type: 'string' },
        group: { type: 'string', description: 'Ülke/grup sınırı (ör. turkey)' },
        overwrite: { type: 'boolean', description: 'Mevcut logoların üzerine yaz (varsayılan false)' },
        dryRun: { type: 'boolean', description: 'Sadece önizle, yazma' },
      },
    },
    async run(args, ctx) {
      const overwrite = args.overwrite === true;
      // Ustune yazmak veri kaybettirir: mevcut logo geri getirilemez.
      if (overwrite) assertDestructive(ctx, 'apply_library_logos(overwrite)');

      const ids = await resolveChannelIds(ctx, args, { max: 5000 });
      const playlistId = args.playlistId || ctx.playlistId || (await ownedChannel(ctx.userId, ids[0])).playlist_id;
      await ownedPlaylist(ctx.userId, playlistId);

      const query = db('channels').whereIn('id', ids).select('id', 'name', 'logo_url');
      if (!overwrite) query.andWhere((builder) => builder.whereNull('logo_url').orWhere('logo_url', ''));
      const channels = await query;

      const matched = [];
      const skipped = [];
      for (const channel of channels) {
        const match = await logoLibrary.bestMatch(channel.name, { group: args.group });
        if (match) matched.push({ id: channel.id, name: channel.name, logo: match.name, url: match.url });
        else skipped.push(channel.name);
      }

      if (args.dryRun === true) {
        return {
          dryRun: true,
          candidates: matched.length,
          skipped: skipped.length,
          sample: matched.slice(0, 20).map((row) => ({ channel: row.name, logo: row.logo })),
          skippedSample: skipped.slice(0, 20),
        };
      }

      // Kanal basina tek UPDATE yerine tek sorguda toplu yazim: 5000 kanalda
      // fark binlerce gidis-donus demek.
      let updated = 0;
      if (matched.length) {
        const cases = matched.map(() => 'WHEN ? THEN ?').join(' ');
        const bindings = matched.flatMap((row) => [row.id, row.url]);
        const result = await db.raw(
          `UPDATE channels SET logo_url = CASE id ${cases} END, updated_at = NOW()
            WHERE id = ANY(?::uuid[]) RETURNING id`,
          [...bindings, matched.map((row) => row.id)]
        );
        updated = result.rows.length;
      }

      return {
        updated,
        skipped: skipped.length,
        skippedSample: skipped.slice(0, 20),
        sample: matched.slice(0, 10).map((row) => ({ channel: row.name, logo: row.logo })),
      };
    },
  },
};
