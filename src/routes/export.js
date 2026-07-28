const express = require('express');
const exportController = require('../controllers/exportController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Authenticated export & share endpoints
router.get('/playlists/:id/export', authMiddleware, exportController.exportPlaylist);
router.get('/playlists/:id/xmltv', authMiddleware, exportController.exportXmltv);
router.get('/playlists/:id/epg-coverage', authMiddleware, exportController.getEpgCoverage);
router.post('/playlists/:id/share', authMiddleware, exportController.sharePlaylist);

// Public shared playlist endpoint (no auth)
router.get('/shared/:token/xmltv', exportController.getSharedXmltv);
router.get('/shared/:token', exportController.getShared);

module.exports = router;
