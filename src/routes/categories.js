const express = require('express');
const categoryController = require('../controllers/categoryController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Playlist-scoped category routes
router.get('/playlists/:id/categories', authMiddleware, categoryController.listCategories);
router.post('/playlists/:id/categories', authMiddleware, categoryController.createCategory);

// Category CRUD
router.put('/categories/:id', authMiddleware, categoryController.updateCategory);
router.delete('/categories/:id', authMiddleware, categoryController.deleteCategory);

// Category ordering
router.put('/categories/:id/order', authMiddleware, categoryController.updateCategoryOrder);

module.exports = router;
