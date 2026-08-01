const express = require('express');
const backupController = require('../controllers/backupController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/playlists/:id/backups', authMiddleware, backupController.listBackups);
router.post('/playlists/:id/backups', authMiddleware, backupController.createBackup);
router.get('/backups/:backupId/download', authMiddleware, backupController.downloadBackup);
router.post('/backups/:backupId/restore', authMiddleware, backupController.restoreBackup);
router.delete('/backups/:backupId', authMiddleware, backupController.deleteBackup);

module.exports = router;
