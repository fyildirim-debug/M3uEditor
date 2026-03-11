const express = require('express');
const channelController = require('../controllers/channelController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Playlist-scoped channel listing
router.get('/playlists/:id/channels', authMiddleware, channelController.listChannels);

// Channel CRUD
router.put('/channels/:id', authMiddleware, channelController.updateChannel);
router.delete('/channels/:id', authMiddleware, channelController.deleteChannel);

// Channel ordering
router.put('/channels/:id/order', authMiddleware, channelController.updateChannelOrder);

// Reset to original Xtream values
router.post('/channels/:id/reset', authMiddleware, channelController.resetChannel);

// Logo upload (base64)
router.post('/channels/:id/logo', authMiddleware, channelController.uploadLogo);

// Bulk operations (must be after :id routes to avoid conflict)
router.post('/channels/bulk', authMiddleware, channelController.bulkAction);

module.exports = router;
