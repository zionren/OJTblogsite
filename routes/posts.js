const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const authenticateToken = require('../middleware/auth');
const commentController = require('../controllers/commentController'); // Need this for nested routes if we keep them

// Public Routes
router.get('/', postController.getPosts);
router.get('/:slug', postController.getPostBySlug);
// Note: /:slug conflicts with /id/:id if not careful. 
// Original server.js had /api/posts/:slug and /api/posts/id/:id
// We should check the order. default express matching checks roughly in order.

// Admin/Protected Routes
router.get('/id/:id', authenticateToken, postController.getPostById);
router.post('/', authenticateToken, postController.createPost);
router.put('/:id', authenticateToken, postController.updatePost);
router.delete('/:id', authenticateToken, postController.deletePost);

// Nested Comment Routes (originally /api/posts/:id/comments)
// Ideally handle this in comment routes, but express allows this.
// I'll create the comment controller and import it here or separate it.
// Let's defer this to commentController setup or route setup.

module.exports = router;
