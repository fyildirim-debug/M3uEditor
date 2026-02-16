const express = require('express');
const importController = require('../controllers/importController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Xtream Codes import - mevcut playlist'e
router.post('/playlists/:id/import/xtream', authMiddleware, importController.importFromXtream);

// Xtream Codes import - playlistId olmadan (yeni playlist oluşturur veya mevcut olanı bulur)
router.post('/import/xtream', authMiddleware, importController.importFromXtreamNew);

// Mevcut Xtream kaynağından senkronize et
router.post('/playlists/:id/sync', authMiddleware, importController.syncPlaylist);

module.exports = router;

