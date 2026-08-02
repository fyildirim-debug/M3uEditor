const express = require('express');
const rateLimit = require('express-rate-limit');
const aiController = require('../controllers/aiController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Her sohbet turu saglayiciya birden fazla istek atabilir ve uzun surer;
// kullanici basina sinirlanir ki tek hesap sunucuyu mesgul etmesin.
const chatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 40,
  message: { error: { code: 'RATE_LIMITED', message: 'Çok fazla asistan isteği. Lütfen kısa süre sonra tekrar deneyin.' } },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.userId),
});

router.get('/ai/settings', authMiddleware, aiController.getSettings);
router.put('/ai/settings', authMiddleware, aiController.saveSettings);
router.post('/ai/models', authMiddleware, chatLimiter, aiController.listModels);
router.get('/ai/capabilities', authMiddleware, aiController.listCapabilities);

router.post('/ai/chat', authMiddleware, chatLimiter, aiController.chat);
router.get('/ai/conversations', authMiddleware, aiController.listConversations);
router.get('/ai/conversations/:id', authMiddleware, aiController.getConversation);
router.delete('/ai/conversations/:id', authMiddleware, aiController.deleteConversation);

module.exports = router;
