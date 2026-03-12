const express = require('express');
const epgController = require('../controllers/epgController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// EPG source management
router.post('/epg/sources', authMiddleware, epgController.addSource);
router.get('/epg/sources', authMiddleware, epgController.listSources);
router.delete('/epg/sources/:id', authMiddleware, epgController.deleteSource);
router.post('/epg/sources/:id/refresh', authMiddleware, epgController.refreshSource);

// EPG channel search (autocomplete)
router.get('/epg/channels/search', authMiddleware, epgController.searchEpgChannels);

// Playlist-scoped EPG endpoints
router.post('/playlists/:id/epg/auto-match', authMiddleware, epgController.autoMatch);
router.get('/playlists/:id/epg/guide', authMiddleware, epgController.getGuide);

// Channel-scoped EPG endpoints
router.get('/channels/:id/epg/preview', authMiddleware, epgController.getPreview);
router.put('/channels/:id/epg', authMiddleware, epgController.assignEpg);

module.exports = router;
