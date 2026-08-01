const express = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/registration-status', authController.registrationStatus);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/logout', authMiddleware, authController.logout);
router.get('/profile', authMiddleware, authController.getProfile);
router.get('/sessions', authMiddleware, authController.listSessions);
router.delete('/sessions/:familyId', authMiddleware, authController.revokeSession);
router.put('/password', authMiddleware, authController.changePassword);
router.put('/email', authMiddleware, authController.changeEmail);
router.delete('/account', authMiddleware, authController.deleteAccount);

module.exports = router;
