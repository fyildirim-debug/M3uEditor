const express = require('express');
const viewController = require('../controllers/viewController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Playlist-scoped view routes
router.get('/playlists/:id/views', authMiddleware, viewController.listViews);
router.post('/playlists/:id/views', authMiddleware, viewController.createView);

// View CRUD
router.put('/views/:id', authMiddleware, viewController.updateView);
router.delete('/views/:id', authMiddleware, viewController.deleteView);

module.exports = router;
