const express = require('express');
const streamHealthController = require('../controllers/streamHealthController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/playlists/:id/health-scan', authMiddleware, streamHealthController.startHealthScan);
router.get('/playlists/:id/health-scan', authMiddleware, streamHealthController.getHealthScanStatus);
router.get('/playlists/:id/health-stats', authMiddleware, streamHealthController.getHealthStats);

module.exports = router;
