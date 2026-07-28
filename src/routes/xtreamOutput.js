const express = require('express');
const authMiddleware = require('../middleware/auth');
const controller = require('../controllers/xtreamOutputController');

const router = express.Router();

router.post('/api/playlists/:id/xtream-output', authMiddleware, controller.enable);
router.get('/api/playlists/:id/xtream-output', authMiddleware, controller.getConfiguration);
router.post('/api/playlists/:id/xtream-output/regenerate', authMiddleware, controller.regenerate);
router.delete('/api/playlists/:id/xtream-output', authMiddleware, controller.disable);

router.get('/player_api.php', controller.playerApi);
router.get('/xmltv.php', controller.xmltv);
router.get('/get.php', controller.m3u);
router.get('/live/:username/:password/:streamId.:ext', controller.playLive);
router.get('/movie/:username/:password/:streamId.:ext', controller.playMovie);
router.get('/series/:username/:password/:streamId.:ext', controller.playSeries);

module.exports = router;
