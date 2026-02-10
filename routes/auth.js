const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticateToken = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit'); // We can apply specific rate limits if needed

router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/check', authenticateToken, authController.checkAuth);

module.exports = router;
