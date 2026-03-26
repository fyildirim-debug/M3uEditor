const express = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/logout', authMiddleware, authController.logout);
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/password', authMiddleware, authController.changePassword);
router.put('/email', authMiddleware, authController.changeEmail);
router.delete('/account', authMiddleware, authController.deleteAccount);
router.get('/plan', authMiddleware, authController.getPlan);

module.exports = router;
