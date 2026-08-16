const express = require('express');
const logoLibraryController = require('../controllers/logoLibraryController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// tv-logo/tv-logos hazir logo kutuphanesi (salt-okunur, auth zorunlu)
router.get('/logo-library/groups', authMiddleware, logoLibraryController.listGroups);
router.get('/logo-library/search', authMiddleware, logoLibraryController.search);

module.exports = router;
