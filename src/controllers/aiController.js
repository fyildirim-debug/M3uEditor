const aiService = require('../services/AIService');
const tools = require('../services/ai/tools');
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
    const { message, conversationId, playlistId, allowDestructive } = req.body || {};
    res.json(await aiService.chat(req.userId, { message, conversationId, playlistId, allowDestructive }));
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
        .filter((message) => ['user', 'assistant'].includes(message.role) && message.content)
        .map((message) => ({ role: message.role, content: message.content, createdAt: message.created_at })),
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
  listConversations,
  getConversation,
  deleteConversation,
  listCapabilities,
};
