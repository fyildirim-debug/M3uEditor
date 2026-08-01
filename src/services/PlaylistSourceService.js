const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { encrypt } = require('../utils/crypto');
const { createAppError } = require('../utils/AppError');
const XtreamClient = require('./XtreamClient');

const SAFE_COLUMNS = ['id', 'server_url', 'username', 'label', 'position', 'last_synced_at', 'created_at'];
const MAX_SOURCES_PER_PLAYLIST = 10;

/**
 * Ek Xtream kaynaklari (coklu kaynak birlestirme). Ana kaynak geriye uyumlu
 * olarak playlists.xtream_* kolonlarinda kalir; bu servis yalnizca ek
 * kaynaklari yonetir. Kimlik dogrulama ekleme sirasinda YAPILMAZ — saglayici
 * gecici olarak kapaliyken bile kaynak kaydedilebilsin diye; hatalar sync
 * sirasinda kaynak bazinda raporlanir.
 */
class PlaylistSourceService {
  async _assertPlaylist(userId, playlistId) {
    const playlist = await db('playlists').where({ id: playlistId, user_id: userId }).first('id');
    if (!playlist) throw createAppError('NOT_FOUND', 'Oynatma listesi bulunamadı');
    return playlist;
  }

  async list(userId, playlistId) {
    await this._assertPlaylist(userId, playlistId);
    return db('playlist_sources')
      .where({ playlist_id: playlistId })
      .orderBy('position', 'asc')
      .orderBy('created_at', 'asc')
      .select(SAFE_COLUMNS);
  }

  async create(userId, playlistId, data = {}) {
    await this._assertPlaylist(userId, playlistId);
    const { serverUrl, username, password, label } = data;
    if (![serverUrl, username, password].every((value) => typeof value === 'string' && value.trim())) {
      throw createAppError('VALIDATION_ERROR', 'Sunucu adresi, kullanıcı adı ve şifre gerekli');
    }
    if (serverUrl.length > 2048 || username.length > 500 || password.length > 500) {
      throw createAppError('VALIDATION_ERROR', 'Xtream bağlantı bilgileri çok uzun');
    }
    if (label !== undefined && label !== null && (typeof label !== 'string' || label.length > 255)) {
      throw createAppError('VALIDATION_ERROR', 'Etiket en fazla 255 karakter olabilir');
    }

    const count = await db('playlist_sources').where({ playlist_id: playlistId }).count('id as count').first();
    if (Number(count?.count || 0) >= MAX_SOURCES_PER_PLAYLIST) {
      throw createAppError('VALIDATION_ERROR', `Bir liste için en fazla ${MAX_SOURCES_PER_PLAYLIST} ek kaynak tanımlanabilir`);
    }

    // XtreamClient kurucusu URL'yi normalize eder (scheme, trailing slash vb.)
    const normalizedUrl = new XtreamClient(serverUrl.trim(), username.trim(), password).serverUrl;
    const duplicate = await db('playlist_sources')
      .where({ playlist_id: playlistId, server_url: normalizedUrl, username: username.trim() })
      .first('id');
    if (duplicate) throw createAppError('VALIDATION_ERROR', 'Bu kaynak zaten ekli');

    const max = await db('playlist_sources').where({ playlist_id: playlistId }).max('position as max').first();
    const [source] = await db('playlist_sources').insert({
      id: uuidv4(),
      playlist_id: playlistId,
      server_url: normalizedUrl,
      username: username.trim(),
      password_enc: encrypt(password),
      label: label?.trim() || null,
      position: (max?.max ?? -1) + 1,
    }).returning(SAFE_COLUMNS);
    return source;
  }

  async remove(userId, sourceId) {
    const source = await db('playlist_sources')
      .join('playlists', 'playlists.id', 'playlist_sources.playlist_id')
      .where('playlist_sources.id', sourceId)
      .where('playlists.user_id', userId)
      .first('playlist_sources.id');
    if (!source) throw createAppError('NOT_FOUND', 'Kaynak bulunamadı');
    await db('playlist_sources').where({ id: sourceId }).del();
  }
}

module.exports = PlaylistSourceService;
