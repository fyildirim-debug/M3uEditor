/**
 * Asistan dosya deposu.
 *
 * Iki tur kayit tutar:
 *  - `upload`: kullanicinin sohbete iliştirdigi dosya (M3U, XMLTV, JSON, CSV, metin).
 *  - `output`: asistanin urettigi, kullanicinin indirebilecegi cikti.
 *
 * Icerik diskte `<aiAttachmentDir>/<userId>/<attachmentId>` altinda durur; dosya
 * adi kullanicidan gelen metinden degil, uretilen kimlikten olusur, boylece
 * dizin gecisi (path traversal) mumkun degildir. Veritabaninda yalnizca ustveri,
 * kisa onizleme ve tur tespiti saklanir — 20 MB'lik bir liste satir satir
 * diskten okunur, hicbir zaman toptan modele gonderilmez.
 */

const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');
const config = require('../../config');
const logger = require('../../config/logger');
const { createAppError } = require('../../utils/AppError');

// Onizleme modele ve arayuze gider; dosyanin ne oldugunu anlatmaya yeter.
const PREVIEW_CHARS = 1200;
// Tek `read_attachment` cagrisinda modele donebilecek en fazla karakter.
const MAX_READ_CHARS = 20_000;
const MAX_SEARCH_MATCHES = 100;
const MAX_FILENAME_LENGTH = 200;

const FORMAT_MIMES = {
  m3u: 'audio/x-mpegurl',
  xmltv: 'application/xml',
  json: 'application/json',
  csv: 'text/csv',
  text: 'text/plain',
};

/** Uzantiya guvenilmez: bicim her zaman icerigin ilk satirlarindan tespit edilir. */
function detectFormat(sample, filename = '') {
  const head = String(sample || '').slice(0, 4000);
  const trimmed = head.trimStart();
  if (/^#EXTM3U/i.test(trimmed) || /^#EXTINF:/im.test(head)) return 'm3u';
  if (/^<\?xml/i.test(trimmed) || /<tv\b/i.test(head) || /<programme\b/i.test(head)) return 'xmltv';
  if (/^[[{]/.test(trimmed)) {
    try {
      JSON.parse(sample);
      return 'json';
    } catch { /* tam govde parse edilemiyorsa asagidaki tahminlere dus */ }
    if (/\.json$/i.test(filename)) return 'json';
  }
  if (/\.csv$/i.test(filename) || /^[^\n,;]{1,80}[,;][^\n]{1,200}\n/.test(head)) return 'csv';
  if (/\.(m3u8?|txt)$/i.test(filename)) return /#EXTINF/i.test(head) ? 'm3u' : 'text';
  return 'text';
}

/** Bicime gore ucuz bir ozet: modelin dosyayi actirmadan ne oldugunu anlamasi icin. */
function buildMeta(format, content) {
  try {
    if (format === 'm3u') {
      const entries = content.match(/^#EXTINF:/gim)?.length || 0;
      const groups = new Set();
      for (const match of content.matchAll(/group-title="([^"]{1,120})"/gi)) groups.add(match[1]);
      return { entryCount: entries, groupCount: groups.size, groups: [...groups].slice(0, 40) };
    }
    if (format === 'xmltv') {
      return {
        channelCount: content.match(/<channel\b/gi)?.length || 0,
        programmeCount: content.match(/<programme\b/gi)?.length || 0,
      };
    }
    if (format === 'json') {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return { arrayLength: parsed.length, keys: Object.keys(parsed[0] || {}).slice(0, 30) };
      }
      return { keys: Object.keys(parsed || {}).slice(0, 30) };
    }
    if (format === 'csv') {
      const [header] = content.split(/\r?\n/, 1);
      const delimiter = (header.match(/;/g)?.length || 0) > (header.match(/,/g)?.length || 0) ? ';' : ',';
      return { columns: header.split(delimiter).map((column) => column.trim().slice(0, 60)).slice(0, 40), delimiter };
    }
  } catch (error) {
    logger.debug({ err: error, format }, 'AI attachment meta could not be built');
  }
  return {};
}

function safeFilename(value, fallback) {
  const base = path.basename(String(value || '').trim()).replace(/[\x00-\x1f\x7f]/g, '');
  const cleaned = base.replace(/[^\p{L}\p{N}._ -]/gu, '_').trim();
  return (cleaned || fallback).slice(0, MAX_FILENAME_LENGTH);
}

function rowToPublic(row) {
  return {
    id: row.id,
    filename: row.filename,
    format: row.format,
    kind: row.kind,
    sizeBytes: Number(row.size_bytes),
    lineCount: row.line_count,
    preview: row.preview,
    meta: typeof row.meta === 'string' ? JSON.parse(row.meta) : (row.meta || {}),
    createdAt: row.created_at,
    downloadUrl: `/api/ai/attachments/${row.id}/download`,
  };
}

class AiAttachmentStore {
  _dir(userId) {
    return path.join(config.aiAttachmentDir, String(userId));
  }

  _path(userId, attachmentId) {
    return path.join(this._dir(userId), attachmentId);
  }

  async usedBytes(userId) {
    const row = await db('ai_attachments').where({ user_id: userId }).sum('size_bytes as total').first();
    return Number(row?.total || 0);
  }

  /**
   * Metni diske yazar ve ustverisini kaydeder.
   * @param {string} userId
   * @param {{conversationId?: string, filename?: string, content: string, kind?: 'upload'|'output', format?: string}} input
   */
  async save(userId, { conversationId = null, filename, content, kind = 'upload', format } = {}) {
    const text = typeof content === 'string' ? content : String(content ?? '');
    const bytes = Buffer.byteLength(text, 'utf8');
    if (!bytes) throw createAppError('VALIDATION_ERROR', 'Dosya içeriği boş');
    if (bytes > config.ai.attachmentBytes) {
      const limitMb = Math.round(config.ai.attachmentBytes / (1024 * 1024));
      throw createAppError('VALIDATION_ERROR', `Dosya en fazla ${limitMb} MB olabilir`);
    }

    const used = await this.usedBytes(userId);
    if (used + bytes > config.ai.attachmentQuotaBytes) {
      const quotaMb = Math.round(config.ai.attachmentQuotaBytes / (1024 * 1024));
      throw createAppError('VALIDATION_ERROR', `Asistan dosya alanı doldu (sınır ${quotaMb} MB). Eski dosyaları silin.`);
    }

    const id = uuidv4();
    const resolvedFormat = format || detectFormat(text, filename);
    const name = safeFilename(filename, `dosya-${id.slice(0, 8)}.${resolvedFormat === 'xmltv' ? 'xml' : resolvedFormat}`);

    await fs.mkdir(this._dir(userId), { recursive: true, mode: 0o700 });
    await fs.writeFile(this._path(userId, id), text, { encoding: 'utf8', flag: 'wx', mode: 0o600 });

    const [row] = await db('ai_attachments').insert({
      id,
      user_id: userId,
      conversation_id: conversationId,
      filename: name,
      mime: FORMAT_MIMES[resolvedFormat] || 'text/plain',
      kind,
      format: resolvedFormat,
      size_bytes: bytes,
      line_count: text.split('\n').length,
      preview: text.slice(0, PREVIEW_CHARS),
      storage_path: this._path(userId, id),
      sha256: crypto.createHash('sha256').update(text).digest('hex'),
      meta: JSON.stringify(buildMeta(resolvedFormat, text)),
    }).returning('*');

    logger.info({ userId, attachmentId: id, format: resolvedFormat, bytes, kind }, 'AI attachment stored');
    return rowToPublic(row);
  }

  async list(userId, { conversationId, kind, limit = 50 } = {}) {
    const query = db('ai_attachments').where({ user_id: userId });
    if (conversationId) query.andWhere({ conversation_id: conversationId });
    if (kind) query.andWhere({ kind });
    const rows = await query
      .orderBy('created_at', 'desc')
      .limit(Math.min(Math.max(Number(limit) || 50, 1), 200));
    return rows.map(rowToPublic);
  }

  /** Sahiplik kontrolu tek kapidan gecer: baska kullanicinin eki hicbir yoldan okunamaz. */
  async require(userId, attachmentId) {
    const row = await db('ai_attachments').where({ id: attachmentId, user_id: userId }).first();
    if (!row) throw createAppError('NOT_FOUND', 'Dosya bulunamadı');
    return row;
  }

  async readRaw(userId, attachmentId) {
    const row = await this.require(userId, attachmentId);
    try {
      return { row, content: await fs.readFile(row.storage_path, 'utf8') };
    } catch (error) {
      logger.warn({ err: error, attachmentId }, 'AI attachment file missing on disk');
      throw createAppError('NOT_FOUND', 'Dosya içeriği sunucuda bulunamadı');
    }
  }

  /**
   * Dosyanin bir penceresini dondurur. Model buyuk listeyi tek seferde
   * isteyemesin diye hem satir hem karakter tavani uygulanir.
   */
  async readWindow(userId, attachmentId, { startLine = 1, lineCount = 200, maxChars = MAX_READ_CHARS } = {}) {
    const { row, content } = await this.readRaw(userId, attachmentId);
    const lines = content.split('\n');
    const from = Math.max(Number(startLine) || 1, 1);
    const count = Math.min(Math.max(Number(lineCount) || 200, 1), 2000);
    const slice = lines.slice(from - 1, from - 1 + count);
    let text = slice.join('\n');
    let truncated = false;
    const charCap = Math.min(Math.max(Number(maxChars) || MAX_READ_CHARS, 500), MAX_READ_CHARS);
    if (text.length > charCap) {
      text = text.slice(0, charCap);
      truncated = true;
    }
    return {
      attachmentId: row.id,
      filename: row.filename,
      format: row.format,
      totalLines: lines.length,
      startLine: from,
      returnedLines: slice.length,
      nextStartLine: from + slice.length <= lines.length ? from + slice.length : null,
      truncated,
      content: text,
    };
  }

  async search(userId, attachmentId, { query, limit = 30, caseSensitive = false } = {}) {
    const needle = String(query || '').trim();
    if (!needle) throw createAppError('VALIDATION_ERROR', 'Aranacak metin gerekli');
    const { row, content } = await this.readRaw(userId, attachmentId);
    const lines = content.split('\n');
    const cap = Math.min(Math.max(Number(limit) || 30, 1), MAX_SEARCH_MATCHES);
    const compare = caseSensitive ? needle : needle.toLocaleLowerCase('tr-TR');
    const matches = [];
    for (let index = 0; index < lines.length && matches.length < cap; index++) {
      const line = caseSensitive ? lines[index] : lines[index].toLocaleLowerCase('tr-TR');
      if (line.includes(compare)) matches.push({ line: index + 1, text: lines[index].slice(0, 400) });
    }
    return { attachmentId: row.id, filename: row.filename, query: needle, totalLines: lines.length, matchCount: matches.length, matches };
  }

  async remove(userId, attachmentId) {
    const row = await this.require(userId, attachmentId);
    await db('ai_attachments').where({ id: row.id }).del();
    await fs.rm(row.storage_path, { force: true }).catch((error) => {
      logger.warn({ err: error, attachmentId }, 'AI attachment file could not be deleted');
    });
    return { deleted: true, filename: row.filename };
  }

  /** Sohbet silinirken cagrilir: satirlar zaten kaskadla gider, dosyalar burada. */
  async removeByConversation(userId, conversationId) {
    const rows = await db('ai_attachments').where({ user_id: userId, conversation_id: conversationId }).select('storage_path');
    await Promise.all(rows.map((row) => fs.rm(row.storage_path, { force: true }).catch(() => {})));
    return rows.length;
  }
}

module.exports = new AiAttachmentStore();
module.exports.detectFormat = detectFormat;
module.exports.rowToPublic = rowToPublic;
module.exports.PREVIEW_CHARS = PREVIEW_CHARS;
