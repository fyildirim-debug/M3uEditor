const express = require('express');
const epgController = require('../controllers/epgController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// EPG source management
router.post('/epg/sources', authMiddleware, epgController.addSource);
router.get('/epg/sources', authMiddleware, epgController.listSources);

// Playlist-scoped EPG auto-match
router.post('/playlists/:id/epg/auto-match', authMiddleware, epgController.autoMatch);

// Channel-scoped EPG endpoints
router.get('/channels/:id/epg/preview', authMiddleware, epgController.getPreview);
router.put('/channels/:id/epg', authMiddleware, epgController.assignEpg);

module.exports = router;
