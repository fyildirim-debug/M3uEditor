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

// Add stream types to existing playlist (stored Xtream credentials)
router.post('/playlists/:id/import/add-types', authMiddleware, importController.addStreamTypes);

// M3U file/URL import
router.post('/import/m3u', authMiddleware, importController.importFromM3U);
router.post('/playlists/:id/import/m3u', authMiddleware, importController.importM3UToPlaylist);

module.exports = router;

