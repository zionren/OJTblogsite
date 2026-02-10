const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const authenticateToken = require('../middleware/auth');

// Public Routes (Nested under posts in original API, but we map them here)
// Note: The mount point in server.js will determine the final URL. 
// If we mount this at /api, these paths must match original specific paths.

// Originally: /api/posts/:id/comments
router.get('/posts/:id/comments', commentController.getPostComments);
router.post('/posts/:id/comments', commentController.createComment);

// Admin Routes
// Originally: /api/admin/comments
router.get('/admin/comments', authenticateToken, commentController.getAdminComments);
// Originally: /api/admin/comments/:id
router.delete('/admin/comments/:id', authenticateToken, commentController.deleteComment);

module.exports = router;
