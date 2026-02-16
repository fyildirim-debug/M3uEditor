const express = require('express');
const exportController = require('../controllers/exportController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Authenticated export & share endpoints
router.get('/playlists/:id/export', authMiddleware, exportController.exportPlaylist);
router.post('/playlists/:id/share', authMiddleware, exportController.sharePlaylist);

// Public shared playlist endpoint (no auth)
router.get('/shared/:token', exportController.getShared);

module.exports = router;
