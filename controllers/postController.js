const { client } = require('../config/database'); // Using client for raw SQL compatibility
const slugify = require('slugify');
const logActivity = require('../utils/activityLogger');

// Utility to generate unique slug
async function generateUniqueSlug(title) {
    try {
        let baseSlug = slugify(title, {
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g
        });

        let slug = baseSlug;
        let counter = 1;

        while (true) {
            const existingPost = await client`SELECT id FROM posts WHERE slug = ${slug}`;

            if (existingPost.length === 0) {
                return slug;
            }

            counter++;
            slug = `${baseSlug}-${counter}`;
        }
    } catch (error) {
        console.error('Error generating unique slug:', error);
        return slugify(title + '-' + Date.now(), { lower: true, strict: true });
    }
}

const getPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10, published = true } = req.query;
        const offset = (page - 1) * limit;

        // Use parameterized query for safety
        const postsQuery = published === 'true'
            ? client`SELECT *, (SELECT COUNT(*) FROM comments WHERE post_id = posts.id AND approved = true) as comment_count FROM posts WHERE published = true ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
            : client`SELECT *, (SELECT COUNT(*) FROM comments WHERE post_id = posts.id AND approved = true) as comment_count FROM posts ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

        const postsResult = await postsQuery;

        const totalQuery = published === 'true'
            ? client`SELECT COUNT(*) as total FROM posts WHERE published = true`
            : client`SELECT COUNT(*) as total FROM posts`;

        const totalResult = await totalQuery;

        res.json({
            posts: postsResult,
            total: parseInt(totalResult[0].total),
            page: parseInt(page),
            totalPages: Math.ceil(totalResult[0].total / limit)
        });
    } catch (error) {
        console.error('Get posts error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getPostBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const post = await client`SELECT * FROM posts WHERE slug = ${slug} AND published = true`;

        if (post.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Increment view count
        await client`UPDATE posts SET views = views + 1 WHERE id = ${post[0].id}`;

        // Track analytics
        // Note: Ideally analytics tracking should be in its own service/controller or invoked via event
        // keeping it inline for now to match feature parity
        const sessionId = req.headers['x-session-id'] || 'anonymous';
        await client`INSERT INTO analytics (event_type, post_id, session_id, user_agent, ip_address) 
                     VALUES ('post_view', ${post[0].id}, ${sessionId}, ${req.headers['user-agent']}, ${req.ip})`;

        res.json(post[0]);
    } catch (error) {
        console.error('Get post by slug error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getPostById = async (req, res) => {
    try {
        const { id } = req.params;
        const post = await client`SELECT * FROM posts WHERE id = ${id}`;

        if (post.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        res.json(post[0]);
    } catch (error) {
        console.error('Get post by ID error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const createPost = async (req, res) => {
    try {
        const { title, content, youtube_url, published = true } = req.body;
        const user = req.user; // from auth middleware

        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }

        const slug = await generateUniqueSlug(title);

        const result = await client`INSERT INTO posts (title, content, youtube_url, published, slug) 
                                   VALUES (${title}, ${content}, ${youtube_url}, ${published}, ${slug}) 
                                   RETURNING *`;

        if (user) {
            await logActivity(
                user.userId, // JWT payload uses userId
                user.email,
                'CREATE',
                'post',
                result[0].id,
                { title: result[0].title, published: result[0].published },
                req
            );
        }

        res.status(201).json(result[0]);
    } catch (error) {
        console.error('Create post error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const updatePost = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, youtube_url, published } = req.body;
        const user = req.user;

        const originalPost = await client`SELECT * FROM posts WHERE id = ${id}`;
        if (originalPost.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Generate new slug if title changed, ensuring uniqueness excluding current post
        // Logic simplified: if title changed, regen slug. otherwise keep. 
        // Original logic re-checked slug always. We will stick to original logic's intent but maybe only if title changes?
        // Original logic: "Generate unique slug (excluding current post)" implies strict regen based on input title

        let baseSlug = slugify(title, { lower: true, strict: true, remove: /[*+~.()'"!:@]/g });
        let slug = baseSlug;
        let counter = 1;

        while (true) {
            const existingPost = await client`SELECT id FROM posts WHERE slug = ${slug} AND id != ${id}`;
            if (existingPost.length === 0) {
                break;
            }
            counter++;
            slug = `${baseSlug}-${counter}`;
        }

        const result = await client`UPDATE posts 
                                   SET title = ${title}, content = ${content}, youtube_url = ${youtube_url}, 
                                       published = ${published}, slug = ${slug}, updated_at = CURRENT_TIMESTAMP 
                                   WHERE id = ${id} 
                                   RETURNING *`;

        if (user) {
            const changes = {};
            if (originalPost[0].title !== title) changes.title = { from: originalPost[0].title, to: title };
            if (originalPost[0].published !== published) changes.published = { from: originalPost[0].published, to: published };

            await logActivity(user.userId, user.email, 'UPDATE', 'post', parseInt(id), changes, req);
        }

        res.json(result[0]);
    } catch (error) {
        console.error('Update post error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const deletePost = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        const postToDelete = await client`SELECT * FROM posts WHERE id = ${id}`;
        if (postToDelete.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Transaction-like deletion
        // Note: Drizzle or postgres.js transaction `client.begin` would be better here
        // for now keeping sequential to match original "spaghetti" logic but wrapped in try/catch
        await client`DELETE FROM comments WHERE post_id = ${id}`;
        await client`DELETE FROM analytics WHERE post_id = ${id}`;
        await client`DELETE FROM posts WHERE id = ${id}`;

        if (user) {
            await logActivity(
                user.userId,
                user.email,
                'DELETE',
                'post',
                parseInt(id),
                { title: postToDelete[0].title, slug: postToDelete[0].slug },
                req
            );
        }

        res.json({ message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Delete post error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getPosts,
    getPostBySlug,
    getPostById,
    createPost,
    updatePost,
    deletePost
};
