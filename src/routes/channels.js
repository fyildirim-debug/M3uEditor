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

// Bulk operations
router.post('/channels/bulk', authMiddleware, channelController.bulkAction);

module.exports = router;
