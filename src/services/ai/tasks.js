/**
 * Zamanlanmis asistan gorevleri.
 *
 * Bir gorev, belirli araliklarla asistana gonderilen sabit bir istemdir:
 * "olu kanallari test et ve sil", "listeyi senkronize edip EPG eslestir".
 * SchedulerService dakikada bir vadesi geleni sorar, her calistirma kendi
 * sohbetinde yapilir (gecmis sisip baglami doldurmasin) ve sonucu gorev
 * satirina yazilir.
 *
 * GUVENLIK: gorev, sahibinin yetkisiyle calisir. Yikici islem izni gorev
 * bazinda kapalidir (`allow_destructive` varsayilan false) — kimse basinda
 * olmadan silme yapilmasi ancak kullanicinin gorevi acikca boyle kurmasiyla
 * mumkundur. Gozetimsiz calistigi icin onay akisi bu modda devre disidir;
 * onay bekleyen bir cagri gorevi durdurur ve sonuca yazilir.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');
const config = require('../../config');
const logger = require('../../config/logger');
const { createAppError } = require('../../utils/AppError');

const MAX_PROMPT_LENGTH = 4000;
const MAX_RESULT_LENGTH = 4000;
const MAX_TASKS_PER_USER = 25;

function publicTask(row) {
  return {
    id: row.id,
    name: row.name,
    prompt: row.prompt,
    playlistId: row.playlist_id,
    intervalMinutes: row.interval_minutes,
    enabled: row.enabled,
    allowDestructive: row.allow_destructive,
    lastRunAt: row.last_run_at,
    lastStatus: row.last_status,
    lastResult: row.last_result,
    runCount: row.run_count,
    createdAt: row.created_at,
  };
}

function normalizeInterval(value) {
  const minutes = Number.parseInt(value, 10);
  if (!Number.isFinite(minutes)) throw createAppError('VALIDATION_ERROR', 'Çalışma aralığı dakika cinsinden sayı olmalı');
  if (minutes < config.ai.minTaskIntervalMinutes) {
    throw createAppError('VALIDATION_ERROR', `Çalışma aralığı en az ${config.ai.minTaskIntervalMinutes} dakika olabilir`);
  }
  // 30 gun: daha uzunu icin gorev yerine elle calistirma daha dogru.
  if (minutes > 43_200) throw createAppError('VALIDATION_ERROR', 'Çalışma aralığı en fazla 30 gün (43200 dakika) olabilir');
  return minutes;
}

class AiTaskService {
  async list(userId) {
    const rows = await db('ai_tasks').where({ user_id: userId }).orderBy('created_at', 'desc');
    return rows.map(publicTask);
  }

  async require(userId, taskId) {
    const row = await db('ai_tasks').where({ id: taskId, user_id: userId }).first();
    if (!row) throw createAppError('NOT_FOUND', 'Görev bulunamadı');
    return row;
  }

  async create(userId, { name, prompt, intervalMinutes, playlistId = null, allowDestructive = false, enabled = true } = {}) {
    const cleanName = String(name || '').trim();
    const cleanPrompt = String(prompt || '').trim();
    if (!cleanName) throw createAppError('VALIDATION_ERROR', 'Görev adı gerekli');
    if (!cleanPrompt) throw createAppError('VALIDATION_ERROR', 'Görev yönergesi gerekli');
    if (cleanPrompt.length > MAX_PROMPT_LENGTH) {
      throw createAppError('VALIDATION_ERROR', `Görev yönergesi en fazla ${MAX_PROMPT_LENGTH} karakter olabilir`);
    }

    const { count } = await db('ai_tasks').where({ user_id: userId }).count('id as count').first();
    if (Number(count) >= MAX_TASKS_PER_USER) {
      throw createAppError('VALIDATION_ERROR', `En fazla ${MAX_TASKS_PER_USER} zamanlanmış görev tanımlanabilir`);
    }

    if (playlistId) {
      const playlist = await db('playlists').where({ id: playlistId, user_id: userId }).first();
      if (!playlist) throw createAppError('NOT_FOUND', 'Oynatma listesi bulunamadı');
    }

    const [row] = await db('ai_tasks').insert({
      id: uuidv4(),
      user_id: userId,
      playlist_id: playlistId || null,
      name: cleanName.slice(0, 200),
      prompt: cleanPrompt,
      interval_minutes: normalizeInterval(intervalMinutes),
      enabled: enabled !== false,
      allow_destructive: allowDestructive === true,
    }).returning('*');

    logger.info({ userId, taskId: row.id, intervalMinutes: row.interval_minutes }, 'AI task created');
    return publicTask(row);
  }

  async update(userId, taskId, patch = {}) {
    await this.require(userId, taskId);
    const update = {};
    if (patch.name !== undefined) {
      const name = String(patch.name || '').trim();
      if (!name) throw createAppError('VALIDATION_ERROR', 'Görev adı boş olamaz');
      update.name = name.slice(0, 200);
    }
    if (patch.prompt !== undefined) {
      const prompt = String(patch.prompt || '').trim();
      if (!prompt) throw createAppError('VALIDATION_ERROR', 'Görev yönergesi boş olamaz');
      if (prompt.length > MAX_PROMPT_LENGTH) throw createAppError('VALIDATION_ERROR', `Görev yönergesi en fazla ${MAX_PROMPT_LENGTH} karakter olabilir`);
      update.prompt = prompt;
    }
    if (patch.intervalMinutes !== undefined) update.interval_minutes = normalizeInterval(patch.intervalMinutes);
    if (patch.enabled !== undefined) update.enabled = patch.enabled === true;
    if (patch.allowDestructive !== undefined) update.allow_destructive = patch.allowDestructive === true;
    if (patch.playlistId !== undefined) {
      if (patch.playlistId) {
        const playlist = await db('playlists').where({ id: patch.playlistId, user_id: userId }).first();
        if (!playlist) throw createAppError('NOT_FOUND', 'Oynatma listesi bulunamadı');
        update.playlist_id = patch.playlistId;
      } else {
        update.playlist_id = null;
      }
    }
    if (!Object.keys(update).length) throw createAppError('VALIDATION_ERROR', 'Güncellenecek alan yok');

    update.updated_at = db.fn.now();
    const [row] = await db('ai_tasks').where({ id: taskId, user_id: userId }).update(update).returning('*');
    return publicTask(row);
  }

  async remove(userId, taskId) {
    const deleted = await db('ai_tasks').where({ id: taskId, user_id: userId }).del();
    if (!deleted) throw createAppError('NOT_FOUND', 'Görev bulunamadı');
    return { deleted: true };
  }

  /**
   * Gorevi bir kez calistirir. Her calistirma yeni bir sohbet acar; boylece
   * gorev gecmisi buyumez ve her tur ayni temiz baglamdan baslar.
   */
  async run(userId, taskId, { manual = false } = {}) {
    const task = await this.require(userId, taskId);
    // Dairesel bagimlilik: AIService -> tools -> tasks(arac) -> bu servis.
    // Calistirma aninda cozuluyor, modul yuklenirken degil.
    const aiService = require('../AIService');

    const startedAt = Date.now();
    try {
      const result = await aiService.chat(userId, {
        message: task.prompt,
        playlistId: task.playlist_id,
        allowDestructive: task.allow_destructive === true,
        // Gozetimsiz calisiyor: onay bekleyen cagri gorevi bitirir, askida birakmaz.
        requireApproval: false,
        // Gorev icinden baska gorev tetiklenmesini engeller (sonsuz dongu).
        isTaskRun: true,
        conversationTitle: `[Görev] ${task.name}`,
      });

      const summary = [
        result.reply || 'Asistan metin yanıtı üretmedi.',
        result.steps?.length ? `\n\nÇalıştırılan araçlar: ${result.steps.map((step) => step.tool).join(', ')}` : '',
      ].join('').slice(0, MAX_RESULT_LENGTH);

      await db('ai_tasks').where({ id: task.id }).update({
        last_run_at: db.fn.now(),
        last_status: result.pendingApproval ? 'needs_approval' : 'ok',
        last_result: result.pendingApproval
          ? `Görev onay bekleyen bir işlemde durdu: ${result.pendingApproval.tool}. Zamanlanmış görevler onay soramaz; görevin "yıkıcı işlem izni" ayarını açın veya yönergeyi değiştirin.`
          : summary,
        run_count: Number(task.run_count || 0) + 1,
        updated_at: db.fn.now(),
      });

      logger.info({ userId, taskId: task.id, manual, durationMs: Date.now() - startedAt }, 'AI task run completed');
      return { taskId: task.id, status: 'ok', reply: result.reply, steps: result.steps, conversationId: result.conversationId };
    } catch (error) {
      await db('ai_tasks').where({ id: task.id }).update({
        last_run_at: db.fn.now(),
        last_status: 'error',
        last_result: String(error?.message || 'Bilinmeyen hata').slice(0, MAX_RESULT_LENGTH),
        run_count: Number(task.run_count || 0) + 1,
        updated_at: db.fn.now(),
      });
      logger.warn({ err: error, userId, taskId: task.id }, 'AI task run failed');
      throw error;
    }
  }

  /** Vadesi gelen gorevler: hic calismamis ya da son calismadan bu yana araligi dolmus. */
  async listDue(now = new Date()) {
    return db('ai_tasks')
      .where({ enabled: true })
      .andWhere((query) => query
        .whereNull('last_run_at')
        .orWhereRaw(`last_run_at + (interval_minutes || ' minutes')::interval <= ?`, [now]))
      .select('id', 'user_id', 'name');
  }

  /**
   * Gorevi calistirmadan once sahiplenir.
   *
   * Bir asistan turu dakikalarca surebilir; zamanlayici ise dakikada bir bakar.
   * `last_run_at` calistirma BASINDA atomik olarak ileri alinmazsa ayni gorev
   * her turda yeniden baslatilirdi. Kosullu UPDATE ayni anda yalnizca bir
   * calistirmanin gecmesini garanti eder.
   */
  async claim(taskId, now = new Date()) {
    const updated = await db('ai_tasks')
      .where({ id: taskId, enabled: true })
      .andWhere((query) => query
        .whereNull('last_run_at')
        .orWhereRaw(`last_run_at + (interval_minutes || ' minutes')::interval <= ?`, [now]))
      .update({ last_run_at: db.fn.now(), last_status: 'running' });
    return updated > 0;
  }
}

module.exports = new AiTaskService();
module.exports.publicTask = publicTask;
