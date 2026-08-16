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

// Dosya yukleme sohbetten bagimsiz sayilir ama yine de sinirlanir: her yukleme
// diske yazar. Kota kontrolu ayrica servis katmaninda.
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: { code: 'RATE_LIMITED', message: 'Çok fazla dosya yüklemesi. Lütfen kısa süre sonra tekrar deneyin.' } },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.userId),
});

router.post('/ai/chat', authMiddleware, chatLimiter, aiController.chat);
router.post('/ai/chat/stream', authMiddleware, chatLimiter, aiController.chatStream);

router.get('/ai/conversations/:conversationId/approvals', authMiddleware, aiController.listApprovals);
router.post('/ai/approvals/:id', authMiddleware, chatLimiter, aiController.resolveApproval);

router.post('/ai/attachments', authMiddleware, uploadLimiter, aiController.uploadAttachment);
router.get('/ai/attachments', authMiddleware, aiController.listAttachments);
router.get('/ai/attachments/:id/download', authMiddleware, aiController.downloadAttachment);
router.delete('/ai/attachments/:id', authMiddleware, aiController.deleteAttachment);

router.get('/ai/tasks', authMiddleware, aiController.listTasks);
router.post('/ai/tasks', authMiddleware, aiController.createTask);
router.patch('/ai/tasks/:id', authMiddleware, aiController.updateTask);
router.delete('/ai/tasks/:id', authMiddleware, aiController.deleteTask);
router.post('/ai/tasks/:id/run', authMiddleware, chatLimiter, aiController.runTask);
router.get('/ai/tasks/:id/runs', authMiddleware, aiController.listTaskRuns);
router.post('/ai/task-runs/:runId/undo', authMiddleware, aiController.undoTaskRun);

router.get('/ai/conversations', authMiddleware, aiController.listConversations);
router.get('/ai/conversations/:id', authMiddleware, aiController.getConversation);
router.delete('/ai/conversations/:id', authMiddleware, aiController.deleteConversation);

module.exports = router;
