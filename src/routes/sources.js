const express = require('express');
const sourceController = require('../controllers/sourceController');
const importController = require('../controllers/importController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/playlists/:id/sources', authMiddleware, sourceController.listSources);
router.post('/playlists/:id/sources', authMiddleware, sourceController.createSource);
router.delete('/sources/:id', authMiddleware, sourceController.deleteSource);

// Ana kaynak + tum ek kaynaklari sirayla senkronize et (import is kapısindan gecer)
router.post('/playlists/:id/sync-all', authMiddleware, importController.syncAllSources);

module.exports = router;
