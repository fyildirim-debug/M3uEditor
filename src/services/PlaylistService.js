const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { createAppError } = require('../utils/AppError');
const { encrypt } = require('../utils/crypto');
const { removeChannelLogos } = require('../utils/logoStorage');
const backupService = require('./BackupService');

class PlaylistService {
  /**
   * List all playlists for a user, ordered by created_at desc.
   * @param {string} userId
   * @returns {Promise<object[]>}
   */
  async list(userId) {
    // Gruplanmis alt sorgu, kullanicinin listesini gostermek icin TUM
    // kullanicilarin kanallarini tarayip topluyordu. LATERAL sayim her playlist
    // icin (kullanici basina birkac satir) playlist_id indeksini kullanir.
    const playlists = await db('playlists')
      .joinRaw(`
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS channel_count
            FROM channels
           WHERE channels.playlist_id = playlists.id
        ) AS cc ON TRUE
      `)
      .where('playlists.user_id', userId)
      .select(
        'playlists.id',
        'playlists.user_id',
        'playlists.name',
        'playlists.xtream_server_url',
        'playlists.xtream_username',
        'playlists.xtream_stream_types',
        'playlists.last_synced_at',
        'playlists.sync_interval_minutes',
        'playlists.backup_before_sync',
        'playlists.created_at',
        'playlists.updated_at',
        db.raw('(playlists.xtream_password_enc IS NOT NULL) as has_xtream_source'),
        db.raw('(playlists.share_token IS NOT NULL) as is_shared'),
        'playlists.share_expires_at',
        db.raw('COALESCE(cc.channel_count, 0) as channel_count')
      )
      .orderBy('playlists.created_at', 'desc');

    return playlists;
  }

  /**
   * Create a new playlist for the user.
   * @param {string} userId
   * @param {{ name: string }} data
   * @returns {Promise<object>}
   */
  async create(userId, { name }) {
    const [playlist] = await db('playlists')
      .insert({
        id: uuidv4(),
        user_id: userId,
        name,
      })
      .returning(['id', 'user_id', 'name', 'created_at', 'updated_at']);

    return playlist;
  }

  /**
   * Update a playlist's name and/or Xtream credentials. Verifies ownership.
   * Password, when provided, is stored encrypted; omitted fields stay unchanged.
   * @param {string} userId
   * @param {string} playlistId
   * @param {{ name?: string, xtreamServerUrl?: string, xtreamUsername?: string, xtreamPassword?: string }} data
   * @returns {Promise<object>}
   */
  async update(userId, playlistId, { name, xtreamServerUrl, xtreamUsername, xtreamPassword }) {
    const playlist = await db('playlists')
      .where({ id: playlistId, user_id: userId })
      .first();

    if (!playlist) {
      throw createAppError('NOT_FOUND');
    }

    const updates = { updated_at: db.fn.now() };
    if (name !== undefined) updates.name = name;
    if (xtreamServerUrl !== undefined) updates.xtream_server_url = xtreamServerUrl;
    if (xtreamUsername !== undefined) updates.xtream_username = xtreamUsername;
    if (xtreamPassword !== undefined) updates.xtream_password_enc = encrypt(xtreamPassword);

    await db('playlists')
      .where('id', playlistId)
      .update(updates);

    const updated = await db('playlists')
      .where('id', playlistId)
      .select('id', 'user_id', 'name', 'xtream_server_url', 'xtream_username', 'created_at', 'updated_at')
      .first();

    return updated;
  }

  /**
   * Update a playlist's scheduled sync settings. Verifies ownership.
   * @param {string} userId
   * @param {string} playlistId
   * @param {{ syncIntervalMinutes?: number|null, backupBeforeSync?: boolean }} data
   * @returns {Promise<object>}
   */
  async updateSyncSettings(userId, playlistId, { syncIntervalMinutes, backupBeforeSync }) {
    const playlist = await db('playlists')
      .where({ id: playlistId, user_id: userId })
      .first();

    if (!playlist) {
      throw createAppError('NOT_FOUND');
    }

    const updates = { updated_at: db.fn.now() };
    if (syncIntervalMinutes !== undefined) updates.sync_interval_minutes = syncIntervalMinutes;
    if (backupBeforeSync !== undefined) updates.backup_before_sync = backupBeforeSync;

    await db('playlists').where('id', playlistId).update(updates);

    return db('playlists')
      .where('id', playlistId)
      .select('id', 'sync_interval_minutes', 'backup_before_sync', 'updated_at')
      .first();
  }

  /**
   * Delete a playlist and all associated data.
   * Categories and channels cascade via DB foreign keys (ON DELETE CASCADE).
   * Verifies ownership before deletion.
   * @param {string} userId
   * @param {string} playlistId
   */
  async delete(userId, playlistId) {
    const playlist = await db('playlists')
      .where({ id: playlistId, user_id: userId })
      .first();

    if (!playlist) {
      throw createAppError('NOT_FOUND');
    }

    const channelIds = await db.transaction(async (trx) => {
      const channels = await trx('channels').where({ playlist_id: playlist.id }).select('id');
      await trx('playlists').where('id', playlist.id).del();
      return channels.map((channel) => channel.id);
    });
    await removeChannelLogos(channelIds);
    // Yedek satirlari FK ile cascade silinir; gzip dosyalarini da temizle
    await backupService.removePlaylistBackupDir(playlist.id);
  }
}

module.exports = new PlaylistService();
