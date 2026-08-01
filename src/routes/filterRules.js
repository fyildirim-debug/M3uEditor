const express = require('express');
const filterRuleController = require('../controllers/filterRuleController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Test ucu /:id rotalarindan once tanimlanmali degil — farkli path kokleri kullaniyor.
router.get('/playlists/:id/filter-rules', authMiddleware, filterRuleController.listRules);
router.post('/playlists/:id/filter-rules', authMiddleware, filterRuleController.createRule);
router.post('/playlists/:id/filter-rules/test', authMiddleware, filterRuleController.testRule);
router.put('/filter-rules/:id', authMiddleware, filterRuleController.updateRule);
router.delete('/filter-rules/:id', authMiddleware, filterRuleController.deleteRule);
router.put('/filter-rules/:id/order', authMiddleware, filterRuleController.moveRule);

module.exports = router;
