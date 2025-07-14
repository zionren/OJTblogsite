const express = require('express');
const path = require('path');
const cors = require('cors');
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const slugify = require('slugify');
require('dotenv').config();

const { posts, analytics, comments, users } = require('./database/schema');
const { eq, desc, sql, and, gte, lte, count } = require('drizzle-orm');

const app = express();
const PORT = process.env.PORT || 5000;

// Database setup
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
}

// Handle URL encoding issues with Supabase URLs
let client;
try {
    client = postgres(connectionString);
} catch (error) {
    console.error('Database connection error:', error.message);
    // Try with URL parsing for special characters
    try {
        const url = new URL(connectionString);
        client = postgres({
            host: url.hostname,
            port: url.port,
            database: url.pathname.slice(1),
            username: url.username,
            password: url.password,
            ssl: { rejectUnauthorized: false }
        });
    } catch (parseError) {
        console.error('Failed to parse database URL:', parseError.message);
        process.exit(1);
    }
}
const db = drizzle(client);

// Middleware
app.set('trust proxy', 1); // Trust first proxy for rate limiting
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use('/attached_assets', express.static('attached_assets'));

// More lenient rate limiting for production
const rateLimitConfig = process.env.NODE_ENV === 'production' 
    ? {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000, // Higher limit for production
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => {
            // Skip rate limiting for admin API calls
            return req.path.startsWith('/api/analytics') || req.path.startsWith('/api/posts') && req.method === 'GET';
        }
    }
    : {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Lower limit for development
        standardHeaders: true,
        legacyHeaders: false
    };

app.use(rateLimit(rateLimitConfig));

// JWT middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'blog-jwt-secret-key-2025-secure-fallback', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Initialize database
const initializeDatabase = async () => {
    try {
        // Create tables if they don't exist
        await client`
            CREATE TABLE IF NOT EXISTS posts (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                youtube_url VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                published BOOLEAN DEFAULT true,
                views INTEGER DEFAULT 0,
                slug VARCHAR(255) UNIQUE
            )
        `;

        await client`
            CREATE TABLE IF NOT EXISTS analytics (
                id SERIAL PRIMARY KEY,
                event_type VARCHAR(50) NOT NULL,
                post_id INTEGER REFERENCES posts(id),
                session_id VARCHAR(100),
                user_agent TEXT,
                ip_address INET,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                additional_data JSONB
            )
        `;

        await client`
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                post_id INTEGER REFERENCES posts(id),
                author_name VARCHAR(100) NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                approved BOOLEAN DEFAULT true
            )
        `;

        await client`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'admin',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        await client`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                user_email VARCHAR(255),
                action VARCHAR(100) NOT NULL,
                entity_type VARCHAR(50) NOT NULL,
                entity_id INTEGER,
                details JSONB,
                ip_address INET,
                user_agent TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // Create indexes for performance
        await client`CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug)`;
        await client`CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics(event_type)`;
        await client`CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics(timestamp)`;
        await client`CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id)`;
        await client`CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp)`;
        await client`CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id)`;
        await client`CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action)`;

        // Create admin user if it doesn't exist
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@blog.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'blogadmin2025';
        
        const existingAdmin = await client`SELECT id FROM users WHERE email = ${adminEmail}`;
        if (existingAdmin.length === 0) {
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            await client`INSERT INTO users (email, password_hash, role) VALUES (${adminEmail}, ${hashedPassword}, 'admin')`;
            console.log('Admin user created successfully');
        }

        // Add sample posts if none exist
        const existingPosts = await client`SELECT COUNT(*) as count FROM posts`;
        if (parseInt(existingPosts[0].count) === 0) {
            await client`
                INSERT INTO posts (title, content, youtube_url, published, slug, views) VALUES 
                ('Welcome to My Blog', 'This is my first blog post! I''m excited to share my thoughts and experiences with you. This blog will cover various topics including technology, healthcare, and personal development.

Here are some things you can expect:
- In-depth articles about web development
- Personal experiences in the medical field
- Tips for productivity and learning
- Video content and tutorials

Feel free to explore and leave comments on any posts that interest you!', null, true, 'welcome-to-my-blog', 15),
                
                ('Getting Started with Web Development', 'Web development can seem overwhelming at first, but with the right approach, anyone can learn to build amazing websites and applications.

## Essential Technologies

**Frontend:**
- HTML: The structure of web pages
- CSS: Styling and layout
- JavaScript: Interactive functionality

**Backend:**
- Node.js: Server-side JavaScript
- Databases: PostgreSQL, MongoDB
- APIs: REST and GraphQL

## Learning Path

1. Start with HTML and CSS basics
2. Learn JavaScript fundamentals
3. Build simple projects
4. Learn a framework (React, Vue, or Angular)
5. Understand backend concepts
6. Practice with real projects

Remember, consistency is key. Code a little bit every day, and you''ll be amazed at your progress!', 'https://www.youtube.com/watch?v=UB1O30fR-EE', true, 'getting-started-with-web-development', 42),
                
                ('My Journey in Healthcare Technology', 'Working at the intersection of healthcare and technology has been one of the most rewarding experiences of my career. Today I want to share some insights about how technology is transforming patient care.

## Digital Transformation in Healthcare

The healthcare industry is undergoing a massive digital transformation. From electronic health records to telemedicine, technology is making healthcare more accessible and efficient.

### Key Areas of Innovation:

1. **Telemedicine**: Remote consultations have become essential
2. **AI Diagnostics**: Machine learning helps detect diseases earlier
3. **Wearable Technology**: Continuous health monitoring
4. **Electronic Health Records**: Streamlined patient data management

## The Human Element

While technology is incredible, we must never forget that healthcare is fundamentally about human connection. The best healthcare technology enhances the doctor-patient relationship rather than replacing it.

As we continue to innovate, our focus should always be on improving patient outcomes and making healthcare more accessible to everyone.', null, true, 'my-journey-in-healthcare-technology', 28),
                
                ('Building This Blog: A Technical Deep Dive', 'I built this blog using vanilla JavaScript and Node.js to demonstrate that you don''t always need complex frameworks to create powerful web applications.

## Technology Stack

**Frontend:**
- Vanilla HTML, CSS, and JavaScript
- No frameworks or libraries (except for charts)
- Responsive design with CSS Grid and Flexbox
- Custom theming system with CSS variables

**Backend:**
- Node.js with Express
- PostgreSQL database
- Drizzle ORM for database operations
- JWT authentication for admin access

## Key Features

### Analytics Dashboard
The admin dashboard includes comprehensive analytics:
- Total visits and page views
- Most popular posts and videos
- Daily visit trends
- Average time spent on posts

### Theme System
Users can switch between light and dark modes, and admins can customize:
- Background images
- Color schemes
- Font preferences

### Content Management
Easy-to-use admin interface for:
- Creating and editing posts
- Managing comments
- Viewing analytics
- Publishing/unpublishing content

This project proves that vanilla JavaScript is still powerful and relevant in modern web development!', 'https://www.youtube.com/watch?v=hdI2bqOjy3c', true, 'building-this-blog-technical-deep-dive', 67)
            `;
            console.log('Sample posts created successfully');
        }

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
        process.exit(1);
    }
};

// Utility Functions

// Generate unique slug for posts
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

// Activity logging utility function
async function logActivity(user_id, user_email, action, entity_type, entity_id, details, req) {
    try {
        const ip_address = req.ip || req.connection.remoteAddress || 'unknown';
        const user_agent = req.headers['user-agent'] || 'unknown';
        
        await client`
            INSERT INTO activity_logs (user_id, user_email, action, entity_type, entity_id, details, ip_address, user_agent)
            VALUES (${user_id}, ${user_email}, ${action}, ${entity_type}, ${entity_id}, ${JSON.stringify(details)}, ${ip_address}, ${user_agent})
        `;
        
        console.log(`Activity logged: ${action} on ${entity_type} by ${user_email}`);
    } catch (error) {
        console.error('Error logging activity:', error);
    }
}

// Middleware to extract user info for logging
function getUserFromToken(req) {
    try {
        // Try Authorization header first (for API calls)
        const authHeader = req.headers['authorization'];
        let token = authHeader && authHeader.split(' ')[1];
        
        // Fallback to cookies if no Authorization header
        if (!token) {
            token = req.cookies?.token;
        }
        
        if (!token) return null;
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'blog-jwt-secret-key-2025-secure-fallback');
        return { id: decoded.userId, email: decoded.email };
    } catch (error) {
        return null;
    }
}

// Routes

// Authentication
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await client`SELECT * FROM users WHERE email = ${email}`;
        if (user.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user[0].password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user[0].id, email: user[0].email, role: user[0].role },
            process.env.JWT_SECRET || 'blog-jwt-secret-key-2025-secure-fallback',
            { expiresIn: '24h' }
        );

        // Log the login activity
        await logActivity(
            user[0].id, 
            user[0].email, 
            'LOGIN', 
            'user', 
            user[0].id, 
            { role: user[0].role }, 
            req
        );

        res.json({ token, user: { id: user[0].id, email: user[0].email, role: user[0].role } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Posts API
app.get('/api/posts', async (req, res) => {
    try {
        console.log('Posts API called with query:', req.query);
        const { page = 1, limit = 10, published = true } = req.query;
        const offset = (page - 1) * limit;
        
        const postsQuery = published === 'true' 
            ? client`SELECT *, (SELECT COUNT(*) FROM comments WHERE post_id = posts.id AND approved = true) as comment_count FROM posts WHERE published = true ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
            : client`SELECT *, (SELECT COUNT(*) FROM comments WHERE post_id = posts.id AND approved = true) as comment_count FROM posts ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
        
        const postsResult = await postsQuery;
        const totalQuery = published === 'true' 
            ? client`SELECT COUNT(*) as total FROM posts WHERE published = true`
            : client`SELECT COUNT(*) as total FROM posts`;
        
        const totalResult = await totalQuery;
        
        const response = {
            posts: postsResult,
            total: parseInt(totalResult[0].total),
            page: parseInt(page),
            totalPages: Math.ceil(totalResult[0].total / limit)
        };
        
        console.log('Posts API response:', { postsCount: postsResult.length, total: response.total });
        res.json(response);
    } catch (error) {
        console.error('Get posts error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

app.get('/api/posts/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const post = await client`SELECT * FROM posts WHERE slug = ${slug} AND published = true`;
        
        if (post.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Increment view count
        await client`UPDATE posts SET views = views + 1 WHERE id = ${post[0].id}`;

        // Track analytics
        await client`INSERT INTO analytics (event_type, post_id, session_id, user_agent, ip_address) 
                     VALUES ('post_view', ${post[0].id}, ${req.headers['x-session-id'] || 'anonymous'}, ${req.headers['user-agent']}, ${req.ip})`;

        res.json(post[0]);
    } catch (error) {
        console.error('Get post error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get post by ID (for admin editing)
app.get('/api/posts/id/:id', authenticateToken, async (req, res) => {
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
});

app.post('/api/posts', authenticateToken, async (req, res) => {
    try {
        console.log('POST /api/posts - Request body:', req.body);
        const { title, content, youtube_url, published = true } = req.body;
        const user = getUserFromToken(req);
        
        // Validate required fields
        if (!title || !content) {
            console.log('Validation failed - missing title or content');
            return res.status(400).json({ error: 'Title and content are required' });
        }
        
        console.log('Generating unique slug for title:', title);
        const slug = await generateUniqueSlug(title);
        console.log('Final unique slug:', slug);
        
        console.log('Attempting database insert...');
        const result = await client`INSERT INTO posts (title, content, youtube_url, published, slug) 
                                   VALUES (${title}, ${content}, ${youtube_url}, ${published}, ${slug}) 
                                   RETURNING *`;
        
        console.log('Database insert successful:', result[0]);
        
        // Log the activity
        if (user) {
            await logActivity(
                user.id, 
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
        console.error('Create post error details:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

app.put('/api/posts/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, youtube_url, published } = req.body;
        const user = getUserFromToken(req);
        
        // Get the original post for comparison
        const originalPost = await client`SELECT * FROM posts WHERE id = ${id}`;
        if (originalPost.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        // Generate unique slug (excluding current post)
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
        
        // Log the activity
        if (user) {
            const changes = {};
            if (originalPost[0].title !== title) changes.title = { from: originalPost[0].title, to: title };
            if (originalPost[0].published !== published) changes.published = { from: originalPost[0].published, to: published };
            if (originalPost[0].content !== content) changes.content_changed = true;
            
            await logActivity(
                user.id, 
                user.email, 
                'UPDATE', 
                'post', 
                parseInt(id), 
                changes, 
                req
            );
        }

        res.json(result[0]);
    } catch (error) {
        console.error('Update post error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/posts/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const user = getUserFromToken(req);
        
        // Get post details before deletion for logging
        const postToDelete = await client`SELECT * FROM posts WHERE id = ${id}`;
        if (postToDelete.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        // Delete related comments and analytics first
        await client`DELETE FROM comments WHERE post_id = ${id}`;
        await client`DELETE FROM analytics WHERE post_id = ${id}`;
        
        const result = await client`DELETE FROM posts WHERE id = ${id} RETURNING *`;
        
        // Log the activity
        if (user) {
            await logActivity(
                user.id, 
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
});

// Comments API
app.get('/api/posts/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        const comments = await client`SELECT * FROM comments WHERE post_id = ${id} AND approved = true ORDER BY created_at DESC`;
        res.json(comments);
    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/posts/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        const { author_name, content } = req.body;
        
        const result = await client`INSERT INTO comments (post_id, author_name, content) 
                                   VALUES (${id}, ${author_name}, ${content}) 
                                   RETURNING *`;
        
        res.status(201).json(result[0]);
    } catch (error) {
        console.error('Create comment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin Comment Management API
app.get('/api/admin/comments', authenticateToken, async (req, res) => {
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
});

app.delete('/api/admin/comments/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const user = getUserFromToken(req);
        
        // Get comment details before deletion for logging
        const commentToDelete = await client`SELECT * FROM comments WHERE id = ${id}`;
        if (commentToDelete.length === 0) {
            return res.status(404).json({ error: 'Comment not found' });
        }
        
        const result = await client`DELETE FROM comments WHERE id = ${id} RETURNING *`;
        
        // Log the activity
        if (user) {
            await logActivity(
                user.id, 
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
});

// Analytics API
app.get('/api/analytics/dashboard', authenticateToken, async (req, res) => {
    try {
        console.log('Analytics API called by user:', req.user?.email);
        const { startDate, endDate } = req.query;
        
        let dateFilter = '';
        let params = [];
        
        if (startDate && endDate) {
            dateFilter = 'WHERE timestamp >= $1 AND timestamp <= $2';
            params = [startDate, endDate];
        }

        // Total visits
        const totalVisits = await client`SELECT COUNT(*) as count FROM analytics WHERE event_type = 'post_view' ${dateFilter ? client.unsafe(dateFilter) : client``}`;
        
        // Most viewed posts
        const mostViewed = await client`
            SELECT p.title, p.views, p.id 
            FROM posts p 
            ORDER BY p.views DESC 
            LIMIT 10
        `;
        
        // Most watched videos (based on video play events)
        const mostWatched = await client`
            SELECT p.title, COUNT(a.id) as play_count, p.id
            FROM posts p 
            LEFT JOIN analytics a ON p.id = a.post_id AND a.event_type = 'video_play'
            WHERE p.youtube_url IS NOT NULL
            GROUP BY p.id, p.title
            ORDER BY play_count DESC
            LIMIT 10
        `;
        
        // Daily analytics for the last 30 days with zero-fill for missing days
        const dailyAnalytics = await client`
            WITH date_series AS (
                SELECT generate_series(
                    CURRENT_DATE - INTERVAL '29 days',
                    CURRENT_DATE,
                    '1 day'::interval
                )::date as date
            )
            SELECT 
                ds.date,
                COALESCE(COUNT(a.id), 0) as visits
            FROM date_series ds
            LEFT JOIN analytics a ON DATE(a.timestamp) = ds.date 
                AND a.event_type = 'post_view'
            GROUP BY ds.date
            ORDER BY ds.date ASC
        `;
        
        // Average time spent (mock data since we don't track this yet)
        const avgTimeSpent = await client`
            SELECT AVG(EXTRACT(EPOCH FROM (
                SELECT MAX(timestamp) - MIN(timestamp) 
                FROM analytics a2 
                WHERE a2.session_id = analytics.session_id 
                  AND a2.post_id = analytics.post_id
            ))) as avg_seconds
            FROM analytics 
            WHERE event_type = 'post_view'
        `;

        const response = {
            totalVisits: parseInt(totalVisits[0].count),
            mostViewed,
            mostWatched,
            dailyAnalytics,
            avgTimeSpent: Math.round(avgTimeSpent[0].avg_seconds || 0)
        };
        
        console.log('Analytics API response:', { 
            totalVisits: response.totalVisits, 
            mostViewedCount: response.mostViewed.length 
        });
        
        res.json(response);
    } catch (error) {
        console.error('Analytics dashboard error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Get analytics for a specific post
app.get('/api/analytics/post/:id', authenticateToken, async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        
        if (isNaN(postId)) {
            return res.status(400).json({ error: 'Invalid post ID' });
        }

        // Get post details
        const post = await client`SELECT * FROM posts WHERE id = ${postId}`;
        if (post.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Total views for this post
        const totalViews = await client`
            SELECT COUNT(*) as count 
            FROM analytics 
            WHERE post_id = ${postId} AND event_type = 'post_view'
        `;

        // Video plays if it has a YouTube URL
        const videoPlays = await client`
            SELECT COUNT(*) as count 
            FROM analytics 
            WHERE post_id = ${postId} AND event_type = 'video_play'
        `;

        // Daily views for the last 30 days
        const dailyViews = await client`
            WITH date_series AS (
                SELECT generate_series(
                    CURRENT_DATE - INTERVAL '29 days',
                    CURRENT_DATE,
                    '1 day'::interval
                )::date as date
            )
            SELECT 
                ds.date,
                COALESCE(COUNT(a.id), 0) as views
            FROM date_series ds
            LEFT JOIN analytics a ON DATE(a.timestamp) = ds.date 
                AND a.post_id = ${postId} 
                AND a.event_type = 'post_view'
            GROUP BY ds.date
            ORDER BY ds.date ASC
        `;

        // Hourly distribution of views
        const hourlyViews = await client`
            SELECT 
                EXTRACT(HOUR FROM timestamp) as hour,
                COUNT(*) as views
            FROM analytics 
            WHERE post_id = ${postId} AND event_type = 'post_view'
            GROUP BY EXTRACT(HOUR FROM timestamp)
            ORDER BY hour
        `;

        // Comments count
        const commentsCount = await client`
            SELECT COUNT(*) as count 
            FROM comments 
            WHERE post_id = ${postId}
        `;

        // User agents (browsers) breakdown
        const browserStats = await client`
            SELECT 
                CASE 
                    WHEN user_agent ILIKE '%chrome%' THEN 'Chrome'
                    WHEN user_agent ILIKE '%firefox%' THEN 'Firefox'
                    WHEN user_agent ILIKE '%safari%' THEN 'Safari'
                    WHEN user_agent ILIKE '%edge%' THEN 'Edge'
                    ELSE 'Other'
                END as browser,
                COUNT(*) as count
            FROM analytics 
            WHERE post_id = ${postId} AND event_type = 'post_view' AND user_agent IS NOT NULL
            GROUP BY browser
            ORDER BY count DESC
        `;

        // Recent activity (last 10 events)
        const recentActivity = await client`
            SELECT event_type, timestamp, user_agent, ip_address
            FROM analytics 
            WHERE post_id = ${postId}
            ORDER BY timestamp DESC
            LIMIT 10
        `;

        const response = {
            post: post[0],
            totalViews: parseInt(totalViews[0].count),
            videoPlays: parseInt(videoPlays[0].count),
            commentsCount: parseInt(commentsCount[0].count),
            dailyViews,
            hourlyViews,
            browserStats,
            recentActivity
        };

        res.json(response);
    } catch (error) {
        console.error('Post analytics error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Track analytics events
app.post('/api/analytics/track', async (req, res) => {
    try {
        const { eventType, postId, sessionId, additionalData } = req.body;
        
        // Validate required field
        if (!eventType) {
            return res.status(400).json({ error: 'eventType is required' });
        }
        
        // Handle null/undefined values properly
        const safePostId = postId || null;
        const safeSessionId = sessionId || 'anonymous';
        const safeUserAgent = req.headers['user-agent'] || null;
        const safeIpAddress = req.ip || null;
        const safeAdditionalData = additionalData || {};
        
        await client`INSERT INTO analytics (event_type, post_id, session_id, user_agent, ip_address, additional_data) 
                     VALUES (${eventType}, ${safePostId}, ${safeSessionId}, ${safeUserAgent}, ${safeIpAddress}, ${JSON.stringify(safeAdditionalData)})`;
        
        res.json({ success: true });
    } catch (error) {
        console.error('Track analytics error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Activity Logs API
app.get('/api/admin/activity-logs', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 50, action, entity_type, user_email } = req.query;
        const offset = (page - 1) * limit;
        
        let whereConditions = [];
        let params = [];
        
        if (action) {
            whereConditions.push(`action = '${action}'`);
        }
        
        if (entity_type) {
            whereConditions.push(`entity_type = '${entity_type}'`);
        }
        
        if (user_email) {
            whereConditions.push(`user_email ILIKE '%${user_email}%'`);
        }
        
        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
        
        let logsQuery = client`
            SELECT * FROM activity_logs 
            ORDER BY timestamp DESC 
            LIMIT ${limit} OFFSET ${offset}
        `;
        
        let countQuery = client`SELECT COUNT(*) as count FROM activity_logs`;
        
        if (whereConditions.length > 0) {
            const conditions = whereConditions.join(' AND ');
            logsQuery = client.unsafe(`
                SELECT * FROM activity_logs 
                WHERE ${conditions}
                ORDER BY timestamp DESC 
                LIMIT ${limit} OFFSET ${offset}
            `);
            
            countQuery = client.unsafe(`
                SELECT COUNT(*) as count FROM activity_logs 
                WHERE ${conditions}
            `);
        }
        
        const logs = await logsQuery;
        const totalCount = await countQuery;
        
        res.json({
            logs,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(parseInt(totalCount[0].count) / limit),
                totalLogs: parseInt(totalCount[0].count),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get activity logs error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/admin/activity-stats', authenticateToken, async (req, res) => {
    try {
        // Get activity statistics
        const totalLogs = await client`SELECT COUNT(*) as count FROM activity_logs`;
        
        const actionStats = await client`
            SELECT action, COUNT(*) as count 
            FROM activity_logs 
            GROUP BY action 
            ORDER BY count DESC
        `;
        
        const entityStats = await client`
            SELECT entity_type, COUNT(*) as count 
            FROM activity_logs 
            GROUP BY entity_type 
            ORDER BY count DESC
        `;
        
        const recentActivity = await client`
            SELECT DATE(timestamp) as date, COUNT(*) as count 
            FROM activity_logs 
            WHERE timestamp >= NOW() - INTERVAL '30 days'
            GROUP BY DATE(timestamp)
            ORDER BY date DESC
            LIMIT 30
        `;
        
        const topUsers = await client`
            SELECT user_email, COUNT(*) as count 
            FROM activity_logs 
            WHERE user_email IS NOT NULL
            GROUP BY user_email 
            ORDER BY count DESC
            LIMIT 10
        `;
        
        res.json({
            totalLogs: parseInt(totalLogs[0].count),
            actionStats,
            entityStats,
            recentActivity,
            topUsers
        });
    } catch (error) {
        console.error('Get activity stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.get('/post/:slug', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'post.html'));
});

// Initialize database and start server
initializeDatabase().then(() => {
    const host = process.env.NODE_ENV === 'production' ? undefined : 'localhost';
    app.listen(PORT, host, () => {
        console.log(`Server running on ${host ? `http://${host}:${PORT}` : `port ${PORT}`}`);
    });
});
