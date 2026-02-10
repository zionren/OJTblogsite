const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    // Check for token in cookies first, then Authorization header (for backward compatibility or API clients)
    const token = req.cookies.token || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    // SECURITY: Use environment variable or fail. 
    // Ideally we shouldn't have a fallback, but per instructions we want to tighten security.
    // I will keep a safer fallback for dev but log a warning, or just enforce ENV.
    // Let's enforce ENV for security, but provide a dev fallback with explicit warning.
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            console.error('FATAL: JWT_SECRET is not defined in production!');
            return res.status(500).json({ error: 'Server configuration error' });
        }
        console.warn('WARNING: Using insecure fallback JWT secret. Set JWT_SECRET in .env');
    }

    jwt.verify(token, secret || 'blog-jwt-secret-key-2025-secure-fallback', (err, user) => {
        if (err) {
            // If token is invalid/expired, clear the cookie
            res.clearCookie('token');
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

module.exports = authenticateToken;
