const { v4: uuidv4 } = require('uuid');
const safeRegex = require('safe-regex2');
const db = require('../config/database');
const { createAppError } = require('../utils/AppError');
const { validateRegex } = require('../utils/validation');

const FILTER_FIELDS = new Set(['group', 'name', 'url']);
const MAX_RULES_PER_PLAYLIST = 100;

/**
 * Regex filtre kurallari: Xtream import/sync sirasinda kayitlari kategori adi
 * (group), kanal adi (name) veya akis adresi (url) uzerinden dahil et / haric tut.
 *
 * Degerlendirme semantigi (kayit basina, sort_order sirasiyla):
 *  - Eslesen ILK kural karar verir: exclude → at, include → tut.
 *  - Hic kural eslesmezse: include kurali varsa varsayilan AT, yoksa varsayilan TUT.
 */
class FilterRuleService {
  async _assertPlaylist(userId, playlistId) {
    const playlist = await db('playlists').where({ id: playlistId, user_id: userId }).first('id');
    if (!playlist) throw createAppError('NOT_FOUND', 'Oynatma listesi bulunamadı');
    return playlist;
  }

  async _getRule(userId, ruleId) {
    const rule = await db('filter_rules')
      .join('playlists', 'playlists.id', 'filter_rules.playlist_id')
      .where('filter_rules.id', ruleId)
      .where('playlists.user_id', userId)
      .first('filter_rules.*');
    if (!rule) throw createAppError('NOT_FOUND', 'Filtre kuralı bulunamadı');
    return rule;
  }

  _validateRuleInput({ field, pattern }) {
    if (!FILTER_FIELDS.has(field)) {
      throw createAppError('VALIDATION_ERROR', 'Alan group, name veya url olmalıdır');
    }
    validateRegex(pattern);
    return pattern.trim();
  }

  async list(userId, playlistId) {
    await this._assertPlaylist(userId, playlistId);
    return db('filter_rules')
      .where({ playlist_id: playlistId })
      .orderBy('sort_order', 'asc')
      .orderBy('created_at', 'asc');
  }

  async create(userId, playlistId, data = {}) {
    await this._assertPlaylist(userId, playlistId);
    const pattern = this._validateRuleInput(data);
    const count = await db('filter_rules').where({ playlist_id: playlistId }).count('id as count').first();
    if (Number(count?.count || 0) >= MAX_RULES_PER_PLAYLIST) {
      throw createAppError('VALIDATION_ERROR', `Bir liste için en fazla ${MAX_RULES_PER_PLAYLIST} filtre kuralı tanımlanabilir`);
    }
    const max = await db('filter_rules').where({ playlist_id: playlistId }).max('sort_order as max').first();
    const [rule] = await db('filter_rules').insert({
      id: uuidv4(),
      playlist_id: playlistId,
      field: data.field,
      pattern,
      exclude: data.exclude !== false && data.exclude !== 'false',
      enabled: data.enabled !== false && data.enabled !== 'false',
      sort_order: (max?.max ?? -1) + 1,
    }).returning('*');
    return rule;
  }

  async update(userId, ruleId, data = {}) {
    const rule = await this._getRule(userId, ruleId);
    const patch = {};
    if (data.field !== undefined || data.pattern !== undefined) {
      const merged = { field: data.field ?? rule.field, pattern: data.pattern ?? rule.pattern };
      patch.field = merged.field;
      patch.pattern = this._validateRuleInput(merged);
    }
    if (data.exclude !== undefined) patch.exclude = Boolean(data.exclude);
    if (data.enabled !== undefined) patch.enabled = Boolean(data.enabled);
    if (!Object.keys(patch).length) throw createAppError('VALIDATION_ERROR', 'Güncellenecek alan gönderin');
    patch.updated_at = db.fn.now();
    const [updated] = await db('filter_rules').where({ id: rule.id }).update(patch).returning('*');
    return updated;
  }

  async remove(userId, ruleId) {
    const rule = await this._getRule(userId, ruleId);
    await db('filter_rules').where({ id: rule.id }).del();
  }

  /**
   * Kurali bir komsusuyla yer degistirir. Esit/bozuk sort_order degerlerine
   * karsi tum listenin siralamasi yeniden normalize edilir.
   */
  async move(userId, ruleId, direction) {
    if (!['up', 'down'].includes(direction)) {
      throw createAppError('VALIDATION_ERROR', 'Yön up veya down olmalıdır');
    }
    const rule = await this._getRule(userId, ruleId);
    return db.transaction(async (trx) => {
      const rules = await trx('filter_rules')
        .where({ playlist_id: rule.playlist_id })
        .orderBy('sort_order', 'asc')
        .orderBy('created_at', 'asc');
      const index = rules.findIndex((entry) => entry.id === rule.id);
      const target = direction === 'up' ? index - 1 : index + 1;
      if (index === -1) throw createAppError('NOT_FOUND', 'Filtre kuralı bulunamadı');
      if (target < 0 || target >= rules.length) return rules[index];
      [rules[index], rules[target]] = [rules[target], rules[index]];
      for (let position = 0; position < rules.length; position += 1) {
        if (rules[position].sort_order !== position) {
          await trx('filter_rules').where({ id: rules[position].id }).update({ sort_order: position });
        }
      }
      const moved = rules.find((entry) => entry.id === rule.id);
      return { ...moved, sort_order: rules.indexOf(moved) };
    });
  }

  _valueFor(field, record) {
    if (field === 'group') return record.category_name || '';
    if (field === 'name') return record.name || '';
    return record.stream_url || '';
  }

  /**
   * Kurallari derler. Guvenlik yazim sirasinda validateRegex ile zorlanir;
   * buradaki safeRegex kontrolu derinlemesine savunmadir — gecersiz/guvenli
   * olmayan desen sessizce atlanir (sync'i bozmaz).
   */
  compile(rules) {
    const compiled = [];
    for (const rule of rules || []) {
      if (!rule || rule.enabled === false) continue;
      if (!FILTER_FIELDS.has(rule.field) || typeof rule.pattern !== 'string' || !safeRegex(rule.pattern)) continue;
      try {
        compiled.push({ exclude: Boolean(rule.exclude), field: rule.field, regex: new RegExp(rule.pattern, 'i') });
      } catch {
        // Derlenemeyen desen atlanir; yazim sirasinda zaten dogrulaniyor.
      }
    }
    return compiled;
  }

  /**
   * Derlenmis kurallari kayit listesine uygular. Kayitlardaki gecici
   * `category_name` alani group eslesmesi icin kullanilir ve donen
   * kayitlardan temizlenir (DB kolonu degildir).
   * @returns {{ records: Array, filteredOut: number }}
   */
  applyRules(rules, records) {
    const active = this.compile(rules);
    if (!active.length) {
      for (const record of records) delete record.category_name;
      return { records, filteredOut: 0 };
    }
    const hasInclude = active.some((rule) => !rule.exclude);
    const kept = [];
    let filteredOut = 0;
    for (const record of records) {
      let decision = null;
      for (const rule of active) {
        if (rule.regex.test(this._valueFor(rule.field, record))) {
          decision = rule.exclude ? 'drop' : 'keep';
          break;
        }
      }
      if (decision === null) decision = hasInclude ? 'drop' : 'keep';
      delete record.category_name;
      if (decision === 'keep') kept.push(record);
      else filteredOut += 1;
    }
    return { records: kept, filteredOut };
  }

  /**
   * Playlist'in aktif kurallarini yukleyip kayitlara uygular.
   * ImportService._bulkUpsertChannels ONCESI cagrilir.
   */
  async applyForPlaylist(playlistId, records, connection = db) {
    const rules = await connection('filter_rules')
      .where({ playlist_id: playlistId, enabled: true })
      .orderBy('sort_order', 'asc')
      .orderBy('created_at', 'asc');
    if (!rules.length) {
      for (const record of records) delete record.category_name;
      return { records, filteredOut: 0 };
    }
    return this.applyRules(rules, records);
  }

  /**
   * 'Test et': deseni playlist'in mevcut kanallarinda dener, ilk `limit`
   * eslesmeyi dondurur. JS regex semantigi SQL regex'inden farkli oldugu icin
   * esleme uygulama katmaninda, bir orneklem uzerinde yapilir.
   */
  async testPattern(userId, playlistId, { field, pattern }, limit = 5) {
    await this._assertPlaylist(userId, playlistId);
    this._validateRuleInput({ field, pattern });
    const regex = new RegExp(pattern, 'i');
    const rows = await db('channels')
      .leftJoin('categories', 'channels.category_id', 'categories.id')
      .where('channels.playlist_id', playlistId)
      .orderBy('channels.sort_order', 'asc')
      .limit(1000)
      .select('channels.name', 'channels.stream_url', 'categories.name as group_name');
    const matches = [];
    for (const row of rows) {
      const value = field === 'group' ? (row.group_name || '') : field === 'name' ? (row.name || '') : (row.stream_url || '');
      if (regex.test(value)) {
        matches.push({ name: row.name, group: row.group_name || null });
        if (matches.length >= limit) break;
      }
    }
    return { matches, sampled: rows.length };
  }
}

module.exports = FilterRuleService;
