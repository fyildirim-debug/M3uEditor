/**
 * OpenAI uyumlu saglayicilarla calisan asistan servisi.
 *
 * Kullanici kendi base URL'sini ve API anahtarini girer; modeller saglayicinin
 * /models ucundan cekilir. Sohbet, arac cagrilariyla (function calling) bir
 * dongude ilerler: model arac cagirir, sunucu araci calistirir, sonuc modele
 * geri verilir; model nihai cevabi uretene ya da adim siniri dolana kadar.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const logger = require('../config/logger');
const { createAppError } = require('../utils/AppError');
const { encrypt, decrypt } = require('../utils/crypto');
const { safeFetchText } = require('../utils/safeFetch');
const tools = require('./ai/tools');

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const MAX_MESSAGE_LENGTH = 8000;
const MAX_HISTORY_MESSAGES = 40;
// Arac ciktisi modele giderken kirpilir: tek bir liste baglami doldurmasin.
const MAX_TOOL_RESULT_CHARS = 12000;
const MAX_STEPS_LIMIT = 25;
const REQUEST_TIMEOUT_MS = 180_000;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

const SYSTEM_PROMPT = `Sen M3U Playlist Editor uygulamasının içinde çalışan bir IPTV yönetim asistanısın.

Görevin: kullanıcının oynatma listelerini, kanallarını, kategorilerini, EPG kaynaklarını, içe/dışa aktarımlarını ve yedeklerini sana verilen araçlarla yönetmek.

Kurallar:
- İşi konuşarak değil, araçları çağırarak yap. "Şunu yapabilirim" deme; yapabiliyorsan yap.
- Kimlik (id) gerektiren bir işten önce ilgili listeleme aracını çağırarak gerçek kimlikleri öğren. Kimlik uydurma.
- Katalogda bu turda sana gönderilenden daha fazla araç var. Aradığın işi yapan bir araç listende yoksa önce search_capabilities ile ara, gerekirse describe_capability ile şemasına bak, sonra invoke_capability ile çalıştır. "Bunu yapamıyorum" demeden önce mutlaka search_capabilities dene.
- Yetkin, oturumu açık kullanıcının yetkisiyle birebir aynıdır: yalnızca onun listelerini, kanallarını ve kaynaklarını görebilir ve değiştirebilirsin. Başka kullanıcıların verisine veya yönetici işlemlerine erişimin yoktur; kullanıcı istese bile bunu yapamazsın.
- Cevaplarında Markdown kullanabilirsin: **kalın**, *italik*, tek tırnaklı kod, madde listeleri ve başlıklar doğru biçimde görüntülenir.
- Kullanıcı bir oynatma listesi belirtmediyse ve bağlamda açık bir liste varsa onu kullan; yoksa list_playlists ile sor.
- [YIKICI] etiketli araçlar (silme, üzerine yazma, geri yükleme, paylaşımı iptal) veri kaybettirir. Bunları çağırmadan önce ne kadar veriyi etkileyeceğini ölç (örneğin önce listele/say) ve kullanıcıdan açık onay al. Kullanıcı zaten net biçimde istediyse onayı tekrar sorma.
- Toplu yeniden adlandırmadan önce dryRun=true ile önizle ve sonucu kullanıcıya göster.
- Büyük ve riskli değişikliklerden (birleştirme, toplu silme, geri yükleme) önce create_backup çağırmayı öner.
- Bir araç hata döndürürse hatayı oku, gerekiyorsa düzelt ve yeniden dene; ısrarla aynı hatayı tekrarlama.
- Cevaplarını kullanıcının dilinde, kısa ve somut yaz: ne yaptığını ve sayısal sonucu (kaç kanal, kaç kategori) belirt.
- İçe aktarma, senkronizasyon ve EPG indirme uzun sürebilir; arka planda başlayan işler için kullanıcıya durumu nasıl kontrol edeceğini söyle.`;

function normalizeBaseUrl(value) {
  const url = String(value || '').trim().replace(/\/+$/, '');
  if (!url) throw createAppError('VALIDATION_ERROR', 'Sağlayıcı adresi (base URL) gerekli');
  if (!/^https?:\/\//i.test(url)) throw createAppError('VALIDATION_ERROR', 'Sağlayıcı adresi http:// veya https:// ile başlamalı');
  if (url.length > 2048) throw createAppError('VALIDATION_ERROR', 'Sağlayıcı adresi çok uzun');
  return url;
}

/**
 * Saglayicinin hata govdesinden okunabilir bir sebep cikarir. OpenAI uyumlu
 * gecitler `{error:{message}}` dondurur; bicimi tutmayanlarda ham metin kirpilir.
 */
function providerReason(body) {
  if (!body) return '';
  try {
    const parsed = JSON.parse(body);
    const message = parsed?.error?.message || parsed?.message || parsed?.error?.metadata?.raw || parsed?.detail;
    if (typeof message === 'string' && message.trim()) return message.trim().slice(0, 500);
  } catch { /* JSON degilse ham govdeye dus */ }
  return String(body).replace(/\s+/g, ' ').trim().slice(0, 500);
}

function providerError(error) {
  const status = error?.remoteStatus;
  const reason = providerReason(error?.remoteBody);
  const suffix = reason ? ` Sağlayıcı: ${reason}` : '';

  let appError;
  if (status === 400 || status === 422) {
    appError = createAppError('VALIDATION_ERROR', `Yapay zeka sağlayıcısı isteği reddetti (${status}).${suffix}`);
  } else if (status === 401 || status === 403) {
    appError = createAppError('VALIDATION_ERROR', `Yapay zeka sağlayıcısı API anahtarını reddetti (${status}). Anahtarı kontrol edin.${suffix}`);
  } else if (status === 404) {
    appError = createAppError('VALIDATION_ERROR', `Sağlayıcı adresinde uç bulunamadı (404). Base URL genelde /v1 ile biter.${suffix}`);
  } else if (status === 429) {
    appError = createAppError('VALIDATION_ERROR', `Yapay zeka sağlayıcısı kota/hız sınırı döndürdü (429). Biraz sonra tekrar deneyin.${suffix}`);
  } else if (status >= 500) {
    appError = createAppError('VALIDATION_ERROR', `Yapay zeka sağlayıcısı hata döndürdü (${status}).${suffix}`);
  } else if (error?.code) {
    return error;
  } else {
    appError = createAppError('VALIDATION_ERROR', `Yapay zeka sağlayıcısına ulaşılamadı: ${error?.message || 'bilinmeyen hata'}`);
  }

  appError.remoteStatus = status;
  appError.providerReason = reason;
  return appError;
}

class AIService {
  /* ---------------- Ayarlar ---------------- */

  async _rawSettings(userId) {
    return db('ai_settings').where({ user_id: userId }).first();
  }

  /** İstemciye dönen ayar: API anahtarı asla düz metin değil, yalnızca "var mı" bilgisi. */
  async getSettings(userId) {
    const row = await this._rawSettings(userId);
    return {
      baseUrl: row?.base_url || DEFAULT_BASE_URL,
      model: row?.model || null,
      temperature: row ? Number(row.temperature) : 0.2,
      maxSteps: row?.max_steps ?? 12,
      allowDestructive: row?.allow_destructive ?? true,
      systemPrompt: row?.system_prompt || null,
      hasApiKey: Boolean(row?.api_key_enc),
      configured: Boolean(row?.api_key_enc && row?.model),
    };
  }

  async saveSettings(userId, { baseUrl, apiKey, model, temperature, maxSteps, allowDestructive, systemPrompt } = {}) {
    const existing = await this._rawSettings(userId);
    const patch = { updated_at: db.fn.now() };

    if (baseUrl !== undefined) patch.base_url = normalizeBaseUrl(baseUrl);
    if (apiKey !== undefined) {
      const trimmed = String(apiKey || '').trim();
      if (trimmed.length > 500) throw createAppError('VALIDATION_ERROR', 'API anahtarı çok uzun');
      // Bos gonderim anahtari siler; istemci "degistirme" icin alani hic gondermez.
      patch.api_key_enc = trimmed ? encrypt(trimmed) : null;
    }
    if (model !== undefined) {
      const trimmed = String(model || '').trim();
      if (trimmed.length > 200) throw createAppError('VALIDATION_ERROR', 'Model adı çok uzun');
      patch.model = trimmed || null;
    }
    if (temperature !== undefined) {
      const value = Number(temperature);
      if (!Number.isFinite(value) || value < 0 || value > 2) throw createAppError('VALIDATION_ERROR', 'Sıcaklık 0 ile 2 arasında olmalı');
      patch.temperature = value;
    }
    if (maxSteps !== undefined) {
      const value = Number.parseInt(maxSteps, 10);
      if (!Number.isInteger(value) || value < 1 || value > MAX_STEPS_LIMIT) {
        throw createAppError('VALIDATION_ERROR', `Adım sınırı 1 ile ${MAX_STEPS_LIMIT} arasında olmalı`);
      }
      patch.max_steps = value;
    }
    if (allowDestructive !== undefined) patch.allow_destructive = allowDestructive === true;
    if (systemPrompt !== undefined) {
      const trimmed = String(systemPrompt || '').trim();
      if (trimmed.length > 4000) throw createAppError('VALIDATION_ERROR', 'Ek yönerge en fazla 4000 karakter olabilir');
      patch.system_prompt = trimmed || null;
    }

    if (existing) await db('ai_settings').where({ user_id: userId }).update(patch);
    else await db('ai_settings').insert({ user_id: userId, ...patch });

    return this.getSettings(userId);
  }

  /**
   * Saglayiciya istek atar. Kaydedilmis ayarlar yerine gecici degerler
   * verilebilir; boylece kullanici kaydetmeden once modelleri listeleyebilir.
   */
  async _request(userId, path, body, override = {}) {
    const stored = await this._rawSettings(userId);
    const baseUrl = normalizeBaseUrl(override.baseUrl || stored?.base_url || DEFAULT_BASE_URL);
    const apiKey = override.apiKey !== undefined && String(override.apiKey || '').trim()
      ? String(override.apiKey).trim()
      : (stored?.api_key_enc ? decrypt(stored.api_key_enc) : '');
    if (!apiKey) throw createAppError('VALIDATION_ERROR', 'Önce yapay zeka API anahtarını kaydedin');

    const payload = body ? JSON.stringify(body) : null;
    try {
      const response = await safeFetchText(`${baseUrl}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
          ...(payload ? { 'content-length': String(Buffer.byteLength(payload)) } : {}),
        },
        body: payload || undefined,
        accept: 'application/json',
        timeoutMs: REQUEST_TIMEOUT_MS,
        maxBytes: MAX_RESPONSE_BYTES,
        captureErrorBody: true,
      });
      try {
        return JSON.parse(response.text);
      } catch {
        throw createAppError('VALIDATION_ERROR', 'Sağlayıcı geçerli JSON döndürmedi. Base URL doğru mu?');
      }
    } catch (error) {
      const mapped = providerError(error);
      // Gerekce sunucu gunlugune de yazilir: kullanicidan ekran goruntusu
      // istemeden hangi alanin reddedildigi gorulebilsin.
      if (error?.remoteStatus) {
        logger.warn({ userId, path, status: error.remoteStatus, reason: mapped.providerReason }, 'AI provider rejected request');
      }
      throw mapped;
    }
  }

  /**
   * Sohbet tamamlama istegi. Bazi modeller (akil yurutme modelleri, bazi
   * gecitler) belirli parametreleri 400 ile reddeder; bu durumda istek
   * sadelestirilerek bir kez daha denenir, boylece asistan calismaya devam eder.
   */
  async _chatCompletion(userId, body) {
    try {
      return await this._request(userId, '/chat/completions', body);
    } catch (error) {
      if (error?.remoteStatus !== 400 && error?.remoteStatus !== 422) throw error;
      const reason = String(error.providerReason || '').toLowerCase();

      if (body.temperature !== undefined && /temperature/.test(reason)) {
        const { temperature, ...rest } = body;
        logger.info({ userId }, 'Retrying AI request without temperature');
        return this._request(userId, '/chat/completions', rest);
      }
      if (body.tool_choice !== undefined && /tool_choice/.test(reason)) {
        const { tool_choice: _toolChoice, ...rest } = body;
        logger.info({ userId }, 'Retrying AI request without tool_choice');
        return this._request(userId, '/chat/completions', rest);
      }
      throw error;
    }
  }

  /** Saglayicidaki modelleri listeler (GET /models). */
  async listModels(userId, override = {}) {
    const data = await this._request(userId, '/models', null, override);
    const models = Array.isArray(data?.data) ? data.data : (Array.isArray(data?.models) ? data.models : []);
    return models
      .map((model) => (typeof model === 'string' ? model : model?.id || model?.name))
      .filter((id) => typeof id === 'string' && id)
      .sort((a, b) => a.localeCompare(b));
  }

  /* ---------------- Sohbet ---------------- */

  async listConversations(userId, limit = 20) {
    return db('ai_conversations')
      .where({ user_id: userId })
      .orderBy('updated_at', 'desc')
      .limit(Math.min(Math.max(Number(limit) || 20, 1), 50))
      .select('id', 'title', 'playlist_id', 'updated_at', 'created_at');
  }

  async getConversation(userId, conversationId) {
    const conversation = await db('ai_conversations').where({ id: conversationId, user_id: userId }).first();
    if (!conversation) throw createAppError('NOT_FOUND', 'Sohbet bulunamadı');
    const messages = await db('ai_messages')
      .where({ conversation_id: conversationId })
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc');
    return { conversation, messages };
  }

  async deleteConversation(userId, conversationId) {
    const deleted = await db('ai_conversations').where({ id: conversationId, user_id: userId }).del();
    if (!deleted) throw createAppError('NOT_FOUND', 'Sohbet bulunamadı');
  }

  async _appendMessage(conversationId, message) {
    await db('ai_messages').insert({
      id: uuidv4(),
      conversation_id: conversationId,
      role: message.role,
      content: message.content ?? null,
      tool_calls: message.tool_calls ? JSON.stringify(message.tool_calls) : null,
      tool_call_id: message.tool_call_id || null,
      name: message.name || null,
    });
  }

  /** DB satirlarini OpenAI mesaj bicimine cevirir. */
  _toProviderMessages(rows) {
    return rows.map((row) => {
      const message = { role: row.role };
      if (row.content !== null && row.content !== undefined) message.content = row.content;
      if (row.tool_calls) message.tool_calls = typeof row.tool_calls === 'string' ? JSON.parse(row.tool_calls) : row.tool_calls;
      if (row.tool_call_id) message.tool_call_id = row.tool_call_id;
      if (row.name) message.name = row.name;
      if (message.role === 'assistant' && message.content === undefined) message.content = null;
      return message;
    });
  }

  /**
   * Gecmisi budarken arac cagrisi/sonucu ciftlerini bolmemek onemli: bir
   * `assistant.tool_calls` mesaji, ona ait `tool` mesajlari olmadan
   * gonderilirse saglayicilar istegi reddeder.
   */
  _trimHistory(messages) {
    if (messages.length <= MAX_HISTORY_MESSAGES) return messages;
    let start = messages.length - MAX_HISTORY_MESSAGES;
    while (start < messages.length && messages[start].role === 'tool') start++;
    return messages.slice(start);
  }

  _summarize(value) {
    let text;
    try {
      text = typeof value === 'string' ? value : JSON.stringify(value);
    } catch {
      text = String(value);
    }
    if (text.length <= MAX_TOOL_RESULT_CHARS) return text;
    return `${text.slice(0, MAX_TOOL_RESULT_CHARS)}\n…(sonuç kırpıldı; daha dar bir filtreyle yeniden sorgulayın)`;
  }

  /**
   * Bir kullanici mesajini isler ve asistanin nihai cevabini dondurur.
   * @returns {Promise<{ conversationId: string, reply: string, steps: object[], usage: object }>}
   */
  async chat(userId, { conversationId, message, playlistId, allowDestructive } = {}) {
    const text = String(message || '').trim();
    if (!text) throw createAppError('VALIDATION_ERROR', 'Mesaj boş olamaz');
    if (text.length > MAX_MESSAGE_LENGTH) throw createAppError('VALIDATION_ERROR', `Mesaj en fazla ${MAX_MESSAGE_LENGTH} karakter olabilir`);

    const settings = await this._rawSettings(userId);
    if (!settings?.api_key_enc) throw createAppError('VALIDATION_ERROR', 'Önce yapay zeka ayarlarından API anahtarınızı kaydedin');
    if (!settings.model) throw createAppError('VALIDATION_ERROR', 'Önce bir model seçin');

    let conversation;
    if (conversationId) {
      conversation = await db('ai_conversations').where({ id: conversationId, user_id: userId }).first();
      if (!conversation) throw createAppError('NOT_FOUND', 'Sohbet bulunamadı');
    } else {
      [conversation] = await db('ai_conversations').insert({
        id: uuidv4(),
        user_id: userId,
        playlist_id: playlistId || null,
        title: text.slice(0, 120),
      }).returning('*');
    }

    // Bağlam: hangi oynatma listesinde çalışıldığı ve mevcut listeler.
    let contextNote = '';
    if (playlistId) {
      const playlist = await db('playlists').where({ id: playlistId, user_id: userId }).first('id', 'name');
      if (playlist) contextNote = `\n\nKullanıcı şu anda "${playlist.name}" oynatma listesinde çalışıyor (playlistId: ${playlist.id}). Araç çağrılarında playlistId belirtilmezse bu liste kullanılır.`;
    }
    const systemContent = `${SYSTEM_PROMPT}${settings.system_prompt ? `\n\nKullanıcının ek yönergesi:\n${settings.system_prompt}` : ''}${contextNote}`;

    const history = this._trimHistory(await db('ai_messages')
      .where({ conversation_id: conversation.id })
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc'));

    const messages = [
      { role: 'system', content: systemContent },
      ...this._toProviderMessages(history),
      { role: 'user', content: text },
    ];
    await this._appendMessage(conversation.id, { role: 'user', content: text });

    const ctx = {
      userId,
      playlistId: playlistId || null,
      allowDestructive: allowDestructive === undefined ? settings.allow_destructive !== false : allowDestructive === true,
    };

    const maxSteps = Math.min(settings.max_steps || 12, MAX_STEPS_LIMIT);
    const steps = [];
    const usage = { promptTokens: 0, completionTokens: 0 };
    let reply = '';

    for (let step = 0; step < maxSteps; step++) {
      const response = await this._chatCompletion(userId, {
        model: settings.model,
        messages,
        tools: tools.definitions(),
        tool_choice: 'auto',
        temperature: Number(settings.temperature),
      });

      if (response?.usage) {
        usage.promptTokens += response.usage.prompt_tokens || 0;
        usage.completionTokens += response.usage.completion_tokens || 0;
      }
      const choice = response?.choices?.[0];
      if (!choice) throw createAppError('VALIDATION_ERROR', 'Sağlayıcı beklenen yanıtı döndürmedi');

      const assistantMessage = choice.message || {};
      const toolCalls = Array.isArray(assistantMessage.tool_calls) ? assistantMessage.tool_calls : [];

      messages.push({
        role: 'assistant',
        content: assistantMessage.content ?? null,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      });
      await this._appendMessage(conversation.id, {
        role: 'assistant',
        content: assistantMessage.content ?? null,
        tool_calls: toolCalls.length ? toolCalls : null,
      });

      if (!toolCalls.length) {
        reply = String(assistantMessage.content || '').trim();
        break;
      }

      for (const call of toolCalls) {
        const name = call.function?.name;
        let args = {};
        try {
          args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          args = null;
        }

        const outcome = args === null
          ? { ok: false, error: 'Araç parametreleri geçerli JSON değil' }
          : await tools.execute(name, args, ctx);

        const content = this._summarize(outcome.ok ? outcome.result : { error: outcome.error, code: outcome.code });
        messages.push({ role: 'tool', tool_call_id: call.id, name, content });
        await this._appendMessage(conversation.id, { role: 'tool', tool_call_id: call.id, name, content });

        // Istemciye giden iz kaydi kisa tutulur; tam sonuc zaten modele gitti.
        steps.push({
          tool: name,
          args: args || {},
          ok: outcome.ok,
          destructive: tools.isDestructive(name),
          error: outcome.ok ? undefined : outcome.error,
          result: outcome.ok ? content.slice(0, 600) : undefined,
        });
      }

      if (step === maxSteps - 1) {
        reply = 'Adım sınırına ulaşıldı. Yapılan işlemleri aşağıda görebilirsiniz; devam etmemi isterseniz yazın.';
      }
    }

    await db('ai_conversations').where({ id: conversation.id }).update({ updated_at: db.fn.now() });
    logger.info({ userId, conversationId: conversation.id, toolCalls: steps.length }, 'AI chat completed');

    return { conversationId: conversation.id, reply, steps, usage };
  }
}

module.exports = new AIService();
module.exports.SYSTEM_PROMPT = SYSTEM_PROMPT;
