const aiService = require('../services/AIService');
const tools = require('../services/ai/tools');
const attachments = require('../services/ai/attachments');
const taskService = require('../services/ai/tasks');
const logger = require('../config/logger');
const { createAppError } = require('../utils/AppError');

async function getSettings(req, res, next) {
  try {
    res.json(await aiService.getSettings(req.userId));
  } catch (error) { next(error); }
}

async function saveSettings(req, res, next) {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw createAppError('VALIDATION_ERROR', 'Geçerli bir istek gövdesi gönderin');
    }
    res.json(await aiService.saveSettings(req.userId, body));
  } catch (error) { next(error); }
}

/**
 * Modeller kaydetmeden once de listelenebilsin diye gecici base URL / anahtar
 * kabul edilir; hicbiri kalici olarak yazilmaz.
 */
async function listModels(req, res, next) {
  try {
    const { baseUrl, apiKey } = req.body || {};
    res.json({ models: await aiService.listModels(req.userId, { baseUrl, apiKey }) });
  } catch (error) { next(error); }
}

async function chat(req, res, next) {
  try {
    const { message, conversationId, playlistId, allowDestructive, attachmentIds } = req.body || {};
    res.json(await aiService.chat(req.userId, { message, conversationId, playlistId, allowDestructive, attachmentIds }));
  } catch (error) { next(error); }
}

/**
 * Akisli sohbet (SSE).
 *
 * Yanit gövdesi tek seferde degil, olay olay yazilir: `delta` (metin parcasi),
 * `tool` / `tool-result` (arac adimlari), `approval` (onay bekleyen islem),
 * `attachment` (uretilen dosya), `done` ve `error`. Hata da akis icinde
 * bildirilir, cunku basliklar gonderildikten sonra durum kodu degistirilemez.
 */
async function chatStream(req, res, next) {
  const { message, conversationId, playlistId, allowDestructive, attachmentIds } = req.body || {};
  let closed = false;

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    // Nginx/Traefik arasindaki tamponlama akisi bloklamasin.
    'x-accel-buffering': 'no',
  });
  res.flushHeaders?.();

  const send = (event) => {
    if (closed) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  // Uzun arac zincirlerinde ara katmanlarin baglantiyi dusurmemesi icin nabiz.
  const heartbeat = setInterval(() => { if (!closed) res.write(': ping\n\n'); }, 15_000);
  req.on('close', () => { closed = true; });

  try {
    await aiService.chat(req.userId, {
      message, conversationId, playlistId, allowDestructive, attachmentIds, stream: true, emit: send,
    });
  } catch (error) {
    logger.warn({ err: error, userId: req.userId }, 'AI stream failed');
    send({ type: 'error', message: error?.message || 'Asistan yanıt veremedi', code: error?.code });
  } finally {
    clearInterval(heartbeat);
    if (!closed) res.end();
  }
}

/* ---------------- Onay akisi ---------------- */

async function listApprovals(req, res, next) {
  try {
    res.json({ pending: await aiService.listPendingApprovals(req.userId, req.params.conversationId) });
  } catch (error) { next(error); }
}

async function resolveApproval(req, res, next) {
  try {
    const approved = req.body?.approved === true;
    res.json(await aiService.resolveApproval(req.userId, req.params.id, { approved }));
  } catch (error) { next(error); }
}

/* ---------------- Dosya ekleri ---------------- */

async function uploadAttachment(req, res, next) {
  try {
    const { filename, content, contentBase64, conversationId } = req.body || {};
    let text = content;
    if (typeof contentBase64 === 'string' && contentBase64) {
      if (!/^[A-Za-z0-9+/=\s]+$/.test(contentBase64)) throw createAppError('VALIDATION_ERROR', 'Geçersiz base64 içerik');
      text = Buffer.from(contentBase64, 'base64').toString('utf8');
    }
    if (typeof text !== 'string' || !text.trim()) {
      throw createAppError('VALIDATION_ERROR', 'Dosya içeriği gerekli (content veya contentBase64)');
    }
    res.status(201).json(await attachments.save(req.userId, { conversationId: conversationId || null, filename, content: text }));
  } catch (error) { next(error); }
}

async function listAttachments(req, res, next) {
  try {
    res.json({
      files: await attachments.list(req.userId, {
        conversationId: req.query.conversationId,
        kind: req.query.kind,
        limit: req.query.limit,
      }),
    });
  } catch (error) { next(error); }
}

async function downloadAttachment(req, res, next) {
  try {
    const { row, content } = await attachments.readRaw(req.userId, req.params.id);
    res.setHeader('content-type', `${row.mime}; charset=utf-8`);
    // Dosya adi kullanici verisi: basliga ASCII'ye indirgenmis hali yazilir,
    // gercek ad RFC 5987 biciminde ayrica verilir.
    const asciiName = row.filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
    res.setHeader('content-disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(row.filename)}`);
    res.setHeader('x-content-type-options', 'nosniff');
    res.send(content);
  } catch (error) { next(error); }
}

async function deleteAttachment(req, res, next) {
  try {
    await attachments.remove(req.userId, req.params.id);
    res.status(204).end();
  } catch (error) { next(error); }
}

/* ---------------- Zamanlanmis gorevler ---------------- */

async function listTasks(req, res, next) {
  try {
    res.json({ tasks: await taskService.list(req.userId) });
  } catch (error) { next(error); }
}

async function createTask(req, res, next) {
  try {
    res.status(201).json(await taskService.create(req.userId, req.body || {}));
  } catch (error) { next(error); }
}

async function updateTask(req, res, next) {
  try {
    res.json(await taskService.update(req.userId, req.params.id, req.body || {}));
  } catch (error) { next(error); }
}

async function deleteTask(req, res, next) {
  try {
    await taskService.remove(req.userId, req.params.id);
    res.status(204).end();
  } catch (error) { next(error); }
}

async function runTask(req, res, next) {
  try {
    res.json(await taskService.run(req.userId, req.params.id, { manual: true }));
  } catch (error) { next(error); }
}

async function listConversations(req, res, next) {
  try {
    res.json(await aiService.listConversations(req.userId, req.query.limit));
  } catch (error) { next(error); }
}

async function getConversation(req, res, next) {
  try {
    const { conversation, messages } = await aiService.getConversation(req.userId, req.params.id);
    // Arac cagrisi ic kayitlari istemcide gosterilmez; yalnizca sohbet akisi.
    res.json({
      conversation,
      messages: messages
        .filter((message) => ['user', 'assistant'].includes(message.role) && (message.content || message.attachments))
        .map((message) => ({
          role: message.role,
          content: message.content,
          createdAt: message.created_at,
          attachments: typeof message.attachments === 'string' ? JSON.parse(message.attachments) : (message.attachments || []),
        })),
    });
  } catch (error) { next(error); }
}

async function deleteConversation(req, res, next) {
  try {
    await aiService.deleteConversation(req.userId, req.params.id);
    res.status(204).end();
  } catch (error) { next(error); }
}

/** Asistanin sahip oldugu yetenekleri arayuzde gostermek icin. */
async function listCapabilities(_req, res, next) {
  try {
    const catalogue = tools.catalogue();
    res.json({
      count: catalogue.length,
      // Saglayici sinirlari nedeniyle her turda yalnizca bir kismi gonderilir;
      // kalanina asistan arama araclariyla ulasir.
      sentPerRequest: tools.definitions().length,
      tools: catalogue,
    });
  } catch (error) { next(error); }
}

module.exports = {
  getSettings,
  saveSettings,
  listModels,
  chat,
  chatStream,
  listApprovals,
  resolveApproval,
  uploadAttachment,
  listAttachments,
  downloadAttachment,
  deleteAttachment,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  runTask,
  listConversations,
  getConversation,
  deleteConversation,
  listCapabilities,
};
