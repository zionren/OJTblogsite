const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const authenticateToken = require('../middleware/auth');

// Public tracking endpoint
router.post('/track', analyticsController.trackEvent);

// Admin dashboard
router.get('/dashboard', authenticateToken, analyticsController.getDashboardData);

// Admin Activity Logs (mapped here for convenience as they are analytics-adjacent)
// Originally implied in server.js but not explicitly shown in partial view? 
// No, line 227 of admin.js: `this.setupActivityLogsEventListeners();` calls `/api/admin/activity-logs`? 
// Original server.js view stopped around line 800-1200, but admin.js referenced `mac-bans` and `activity-logs`.
// I will assume the routes should exist.
router.get('/activity-logs', authenticateToken, analyticsController.getActivityLogs);
router.get('/mac-bans', authenticateToken, analyticsController.getMacBans);

module.exports = router;
