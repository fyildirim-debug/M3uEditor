const express = require('express');
const authMiddleware = require('../middleware/auth');
const controller = require('../controllers/xtreamOutputController');

// Yayin adresi hicbir kosulda bu sunucu olmaz: burada yalnizca katalog
// uclari (player_api / xmltv / get.php) yayinlanir. Yayini yerel adresten
// verip 302 ile saglayiciya yonlendiren /live|/movie|/series yollari ve
// bunlari kullanan 'proxy' modu kaldirildi.
const router = express.Router();

router.post('/api/playlists/:id/xtream-output', authMiddleware, controller.enable);
router.get('/api/playlists/:id/xtream-output', authMiddleware, controller.getConfiguration);
router.post('/api/playlists/:id/xtream-output/regenerate', authMiddleware, controller.regenerate);
router.delete('/api/playlists/:id/xtream-output', authMiddleware, controller.disable);

router.get('/player_api.php', controller.playerApi);
router.get('/xmltv.php', controller.xmltv);
router.get('/get.php', controller.m3u);

module.exports = router;
