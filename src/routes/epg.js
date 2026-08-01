const express = require('express');
const epgController = require('../controllers/epgController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// EPG source management
router.post('/epg/sources', authMiddleware, epgController.addSource);
router.get('/epg/sources', authMiddleware, epgController.listSources);
router.delete('/epg/sources/:id', authMiddleware, epgController.deleteSource);
router.post('/epg/sources/:id/refresh', authMiddleware, epgController.refreshSource);
router.put('/epg/sources/:id/refresh-settings', authMiddleware, epgController.updateRefreshSettings);

// EPG channel search (autocomplete)
router.get('/epg/channels/search', authMiddleware, epgController.searchEpgChannels);

// Single program detail (description is loaded lazily from the guide)
router.get('/epg/programs/:id', authMiddleware, epgController.getProgram);

// Playlist-scoped EPG endpoints
router.post('/playlists/:id/epg/auto-match', authMiddleware, epgController.autoMatch);
router.get('/playlists/:id/epg/guide', authMiddleware, epgController.getGuide);

// EPG match profiles (persistent auto-match settings per playlist)
router.get('/playlists/:id/epg-profiles', authMiddleware, epgController.listProfiles);
router.post('/playlists/:id/epg-profiles', authMiddleware, epgController.saveProfile);
router.post('/epg-profiles/:id/run', authMiddleware, epgController.runProfile);
router.delete('/epg-profiles/:id', authMiddleware, epgController.deleteProfile);

// Channel-scoped EPG endpoints
router.get('/channels/:id/epg/preview', authMiddleware, epgController.getPreview);
router.put('/channels/:id/epg', authMiddleware, epgController.assignEpg);

module.exports = router;
