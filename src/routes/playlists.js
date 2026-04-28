const express = require('express');
const playlistController = require('../controllers/playlistController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/playlists', authMiddleware, playlistController.listPlaylists);
router.post('/playlists', authMiddleware, playlistController.createPlaylist);
router.put('/playlists/:id', authMiddleware, playlistController.updatePlaylist);
router.delete('/playlists/:id', authMiddleware, playlistController.deletePlaylist);

module.exports = router;
