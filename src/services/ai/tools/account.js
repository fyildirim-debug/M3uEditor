/**
 * Hesap ve sistem durumu araclari.
 *
 * Yalnizca cagiran kullanicinin kendi verisini okur. Yonetici uclari
 * (kullanici listeleme, baskasinin verisi, sistem ayarlari) bilincli olarak
 * disarida birakilmistir: asistanin yetkisi kendi kullanicisiyla sinirlidir.
 */

const { db, limitRows } = require('../helpers');
const config = require('../../../config');

module.exports = {
  get_account_summary: {
    description: 'Oturum sahibinin hesap özetini verir: e-posta, kayıt tarihi, liste ve kanal sayıları.',
    parameters: {
      type: 'object',
      properties: { includeCounts: { type: 'boolean', description: 'Sayımları da getir (varsayılan true)' } },
    },
    async run(args, ctx) {
      if (args.includeCounts === false) {
        const onlyUser = await db('users').where('id', ctx.userId).first('email', 'created_at');
        return { email: onlyUser?.email, memberSince: onlyUser?.created_at };
      }
      const user = await db('users').where('id', ctx.userId).first('id', 'email', 'created_at');
      const [{ count: playlistCount }] = await db('playlists').where('user_id', ctx.userId).count();
      const [{ count: channelCount }] = await db('channels')
        .join('playlists', 'channels.playlist_id', 'playlists.id')
        .where('playlists.user_id', ctx.userId)
        .count('channels.id as count');
      const [{ count: epgSourceCount }] = await db('epg_sources').where('user_id', ctx.userId).count();
      return {
        email: user?.email,
        memberSince: user?.created_at,
        playlists: Number(playlistCount),
        channels: Number(channelCount),
        epgSources: Number(epgSourceCount),
      };
    },
  },

  get_usage_overview: {
    description: 'Tüm listelerin kanal, kategori ve EPG eşleşme sayılarını tek tabloda özetler.',
    parameters: { type: 'object', properties: { limit: { type: 'integer' } } },
    async run(args, ctx) {
      const result = await db.raw(`
        SELECT p.id, p.name,
               COUNT(DISTINCT ch.id)::int AS channels,
               COUNT(DISTINCT cat.id)::int AS categories,
               COUNT(DISTINCT ch.id) FILTER (WHERE ch.epg_channel_id IS NOT NULL AND ch.epg_channel_id <> '')::int AS epg_matched,
               COUNT(DISTINCT ch.id) FILTER (WHERE ch.logo_url IS NULL OR ch.logo_url = '')::int AS missing_logo,
               p.last_synced_at
          FROM playlists p
          LEFT JOIN channels ch ON ch.playlist_id = p.id
          LEFT JOIN categories cat ON cat.playlist_id = p.id
         WHERE p.user_id = ?
         GROUP BY p.id, p.name, p.last_synced_at
         ORDER BY channels DESC
         LIMIT ?`, [ctx.userId, limitRows(args.limit, 50)]);
      return result.rows;
    },
  },

  get_system_status: {
    description: 'Uygulamanın çalışma durumunu ve dış adresini gösterir.',
    parameters: {
      type: 'object',
      properties: { checkDatabase: { type: 'boolean', description: 'Veritabanına da sorgu at (varsayılan true)' } },
    },
    async run(args) {
      let database = 'skipped';
      if (args.checkDatabase !== false) {
        database = 'ok';
        try { await db.raw('SELECT 1'); } catch { database = 'unavailable'; }
      }
      return {
        database,
        appUrl: config.appUrl,
        uptimeSeconds: Math.round(process.uptime()),
        environment: config.nodeEnv,
      };
    },
  },

  get_recent_activity: {
    description: 'Son güncellenen kanalları ve listeleri gösterir (neyin yeni değiştiğini görmek için).',
    parameters: {
      type: 'object',
      properties: { playlistId: { type: 'string' }, limit: { type: 'integer' } },
    },
    async run(args, ctx) {
      const query = db('channels')
        .join('playlists', 'channels.playlist_id', 'playlists.id')
        .where('playlists.user_id', ctx.userId)
        .orderBy('channels.updated_at', 'desc')
        .limit(limitRows(args.limit, 25))
        .select('channels.id', 'channels.name', 'channels.updated_at', 'playlists.name as playlist_name');
      if (args.playlistId || ctx.playlistId) query.andWhere('channels.playlist_id', args.playlistId || ctx.playlistId);
      return query;
    },
  },

  get_storage_report: {
    description: 'Logo ve yedek kullanımına dair sayıları verir.',
    parameters: {
      type: 'object',
      properties: { playlistId: { type: 'string', description: 'Yalnızca bu liste için' } },
    },
    async run(args, ctx) {
      const logoQuery = db('channels')
        .join('playlists', 'channels.playlist_id', 'playlists.id')
        .where('playlists.user_id', ctx.userId)
        .andWhere('channels.logo_url', 'like', '/logos/%')
        .count('channels.id as count');
      const backupQuery = db('backups')
        .join('playlists', 'backups.playlist_id', 'playlists.id')
        .where('playlists.user_id', ctx.userId)
        .count('backups.id as count')
        .sum('backups.size_bytes as bytes');
      if (args.playlistId) {
        logoQuery.andWhere('channels.playlist_id', args.playlistId);
        backupQuery.andWhere('backups.playlist_id', args.playlistId);
      }
      const [{ count: localLogos }] = await logoQuery;
      const backups = await backupQuery.first();
      return {
        localLogos: Number(localLogos),
        backups: Number(backups?.count || 0),
        backupBytes: Number(backups?.bytes || 0),
      };
    },
  },
};
