const rateLimit = require('express-rate-limit');

// More lenient rate limiting for production
const rateLimitConfig = process.env.NODE_ENV === 'production'
    ? {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000, // Higher limit for production
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => {
            // Skip rate limiting for admin API calls
            return req.path.startsWith('/api/analytics') || (req.path.startsWith('/api/posts') && req.method === 'GET');
        }
    }
    : {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Lower limit for development
        standardHeaders: true,
        legacyHeaders: false
    };

module.exports = rateLimit(rateLimitConfig);
