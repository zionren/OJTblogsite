const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const initializeDatabase = require('./utils/dbInit');
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const commentRoutes = require('./routes/comments');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 4488;

// Security & Middleware
app.set('trust proxy', 1); // Trust first proxy for rate limiting (needed for Vercel/proxies)

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "http://localhost:*", "ws://localhost:*", "https:"], // Allow localhost and HTTPS (for maps/external APIs)
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'self'", "https://www.youtube.com", "https://youtube.com"],
            upgradeInsecureRequests: null, // Disable auto-upgrade to HTTPS for localhost
        },
    },
}));

app.use(cookieParser());
app.use(cors({
    origin: true, // TODO: Tighten this for production to specific domains
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use('/attached_assets', express.static('attached_assets'));

// Redirect clean URLs to their .html files
app.get('/admin', (req, res) => {
    res.redirect('/admin.html');
});
app.get('/about', (req, res) => {
    res.redirect('/about.html');
});

app.get('/post/:slug', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'post.html'));
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api', commentRoutes); // Mounts /posts/:id/comments and /admin/comments
app.use('/api/analytics', analyticsRoutes);

// Database Init
initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});

module.exports = app; // Export for testing/Vercel
