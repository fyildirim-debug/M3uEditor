const express = require('express');
const epgLibraryController = require('../controllers/epgLibraryController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// iptv-org EPG kaynak kutuphanesi (salt-okunur, auth zorunlu)
router.get('/epg-library/countries', authMiddleware, epgLibraryController.listCountries);
router.get('/epg-library/guides', authMiddleware, epgLibraryController.listGuides);

module.exports = router;
