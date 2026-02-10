const { client } = require('../config/database');
const logActivity = require('../utils/activityLogger');

const getPostComments = async (req, res) => {
    try {
        const { id } = req.params;
        const comments = await client`SELECT * FROM comments WHERE post_id = ${id} AND approved = true ORDER BY created_at DESC`;
        res.json(comments);
    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const createComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { author_name, content } = req.body;

        const result = await client`INSERT INTO comments (post_id, author_name, content) 
                                   VALUES (${id}, ${author_name}, ${content}) 
                                   RETURNING *`;

        // Log comment creation? Maybe not needed for public/anonymous users unless we want to track spam.
        // Public doesn't have userId, so we skip standard logging or log as 'system'/'anonymous'.
        // Original code didn't log creation of comments in activity logs (only deletion).

        res.status(201).json(result[0]);
    } catch (error) {
        console.error('Create comment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getAdminComments = async (req, res) => {
    try {
        const { postId } = req.query;

        let query;
        if (postId) {
            query = client`
                SELECT c.*, p.title as post_title, p.slug as post_slug 
                FROM comments c 
                JOIN posts p ON c.post_id = p.id 
                WHERE c.post_id = ${postId}
                ORDER BY c.created_at DESC
            `;
        } else {
            query = client`
                SELECT c.*, p.title as post_title, p.slug as post_slug 
                FROM comments c 
                JOIN posts p ON c.post_id = p.id 
                ORDER BY c.created_at DESC
            `;
        }

        const comments = await query;
        res.json(comments);
    } catch (error) {
        console.error('Get admin comments error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const deleteComment = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        const commentToDelete = await client`SELECT * FROM comments WHERE id = ${id}`;
        if (commentToDelete.length === 0) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        await client`DELETE FROM comments WHERE id = ${id}`;

        if (user) {
            await logActivity(
                user.userId,
                user.email,
                'DELETE',
                'comment',
                parseInt(id),
                {
                    author: commentToDelete[0].author_name,
                    post_id: commentToDelete[0].post_id,
                    content_preview: commentToDelete[0].content.substring(0, 50) + '...'
                },
                req
            );
        }

        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        console.error('Delete comment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getPostComments,
    createComment,
    getAdminComments,
    deleteComment
};
