const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db, client } = require('../config/database');
const { users } = require('../database/schema');
const { eq } = require('drizzle-orm');

// Helper for activity logging 
// TODO: Extract this to a separate service eventually, but for now we keep it here or import it
// Ideally we should import it. Let's make a quick utility for it in utils/logger.js later.
// For now, I'll inline the simple log function to avoid circular deps or complexity until utility is ready.
async function logActivity(userId, userEmail, action, entityType, entityId, details, req) {
    try {
        const ip_address = req.ip || req.connection.remoteAddress || 'unknown';
        const user_agent = req.headers['user-agent'] || 'unknown';

        // Using raw client for now as schema definition for activity_logs might not be fully set up in drizzle output context yet 
        // or we can use the raw sql like server.js did. 
        // Let's stick to raw SQL for logging to match original behavior for now, can refactor to Drizzle later.
        await client`
            INSERT INTO activity_logs (user_id, user_email, action, entity_type, entity_id, details, ip_address, user_agent)
            VALUES (${userId}, ${userEmail}, ${action}, ${entityType}, ${entityId}, ${JSON.stringify(details)}, ${ip_address}, ${user_agent})
        `;
    } catch (error) {
        console.error('Error logging activity:', error);
    }
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Use Drizzle or raw client? The original used raw client. 
        // Let's try to use Drizzle if possible, but fallback to raw if schema is tricky.
        // Users schema is defined.

        // const user = await db.select().from(users).where(eq(users.email, email));
        // Using raw client to ensure compatibility with existing DB setup exactly as before
        const user = await client`SELECT * FROM users WHERE email = ${email}`;

        if (user.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user[0].password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const secret = process.env.JWT_SECRET;
        // Security check
        if (!secret && process.env.NODE_ENV === 'production') {
            throw new Error('JWT_SECRET not configured');
        }

        const token = jwt.sign(
            { userId: user[0].id, email: user[0].email, role: user[0].role },
            secret || 'blog-jwt-secret-key-2025-secure-fallback',
            { expiresIn: '24h' }
        );

        // Set HttpOnly cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // true in production
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

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

        res.json({ success: true, user: { id: user[0].id, email: user[0].email, role: user[0].role } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const logout = (req, res) => {
    res.clearCookie('token');
    res.json({ success: true, message: 'Logged out successfully' });
};

const checkAuth = (req, res) => {
    res.json({ user: req.user });
};

module.exports = {
    login,
    logout,
    checkAuth
};
