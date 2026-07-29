const express = require('express');
const rateLimit = require('express-rate-limit');
const importController = require('../controllers/importController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const xtreamPreviewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: { code: 'RATE_LIMITED', message: 'Çok fazla Xtream önizleme isteği. Lütfen kısa süre sonra tekrar deneyin.' } },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.userId),
});

// Ucuz kategori keşfi, uzun süren import eşzamanlılık kapısına girmez.
router.post('/import/xtream/preview', authMiddleware, xtreamPreviewLimiter, importController.previewXtream);

// Xtream Codes import - mevcut playlist'e
router.post('/playlists/:id/import/xtream', authMiddleware, importController.importFromXtream);

// Xtream Codes import - playlistId olmadan (yeni playlist oluşturur veya mevcut olanı bulur)
router.post('/import/xtream', authMiddleware, importController.importFromXtreamNew);

// Mevcut Xtream kaynağından senkronize et
router.post('/playlists/:id/sync', authMiddleware, importController.syncPlaylist);

// Add stream types to existing playlist (stored Xtream credentials)
router.post('/playlists/:id/import/add-types', authMiddleware, importController.addStreamTypes);

// M3U file/URL import
router.post('/import/m3u', authMiddleware, importController.importFromM3U);
router.post('/playlists/:id/import/m3u', authMiddleware, importController.importM3UToPlaylist);

module.exports = router;
