const { client } = require('../config/database');
const bcrypt = require('bcrypt');

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

        await client`
            CREATE TABLE IF NOT EXISTS mac_bans (
                id SERIAL PRIMARY KEY,
                mac_address VARCHAR(17) UNIQUE NOT NULL,
                reason VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP
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
                ('Welcome to My Blog', 'This is my first blog post! I''m excited to share my thoughts and experiences with you. This blog will cover various topics including technology, healthcare, and personal development.\n\nHere are some things you can expect:\n- In-depth articles about web development\n- Personal experiences in the medical field\n- Tips for productivity and learning\n- Video content and tutorials\n\nFeel free to explore and leave comments on any posts that interest you!', null, true, 'welcome-to-my-blog', 15),
                
                ('Getting Started with Web Development', 'Web development can seem overwhelming at first, but with the right approach, anyone can learn to build amazing websites and applications.\n\n## Essential Technologies\n\n**Frontend:**\n- HTML: The structure of web pages\n- CSS: Styling and layout\n- JavaScript: Interactive functionality\n\n**Backend:**\n- Node.js: Server-side JavaScript\n- Databases: PostgreSQL, MongoDB\n- APIs: REST and GraphQL\n\n## Learning Path\n\n1. Start with HTML and CSS basics\n2. Learn JavaScript fundamentals\n3. Build simple projects\n4. Learn a framework (React, Vue, or Angular)\n5. Understand backend concepts\n6. Practice with real projects\n\nRemember, consistency is key. Code a little bit every day, and you''ll be amazed at your progress!', 'https://www.youtube.com/watch?v=UB1O30fR-EE', true, 'getting-started-with-web-development', 42),
                
                ('My Journey in Healthcare Technology', 'Working at the intersection of healthcare and technology has been one of the most rewarding experiences of my career. Today I want to share some insights about how technology is transforming patient care.\n\n## Digital Transformation in Healthcare\n\nThe healthcare industry is undergoing a massive digital transformation. From electronic health records to telemedicine, technology is making healthcare more accessible and efficient.\n\n### Key Areas of Innovation:\n\n1. **Telemedicine**: Remote consultations have become essential\n2. **AI Diagnostics**: Machine learning helps detect diseases earlier\n3. **Wearable Technology**: Continuous health monitoring\n4. **Electronic Health Records**: Streamlined patient data management\n\n## The Human Element\n\nWhile technology is incredible, we must never forget that healthcare is fundamentally about human connection. The best healthcare technology enhances the doctor-patient relationship rather than replacing it.\n\nAs we continue to innovate, our focus should always be on improving patient outcomes and making healthcare more accessible to everyone.', null, true, 'my-journey-in-healthcare-technology', 28),
                
                ('Building This Blog: A Technical Deep Dive', 'I built this blog using vanilla JavaScript and Node.js to demonstrate that you don''t always need complex frameworks to create powerful web applications.\n\n## Technology Stack\n\n**Frontend:**\n- Vanilla HTML, CSS, and JavaScript\n- No frameworks or libraries (except for charts)\n- Responsive design with CSS Grid and Flexbox\n- Custom theming system with CSS variables\n\n**Backend:**\n- Node.js with Express\n- PostgreSQL database\n- Drizzle ORM for database operations\n- JWT authentication for admin access\n\n## Key Features\n\n### Analytics Dashboard\nThe admin dashboard includes comprehensive analytics:\n- Total visits and page views\n- Most popular posts and videos\n- Daily visit trends\n- Average time spent on posts\n\n### Theme System\nUsers can switch between light and dark modes, and admins can customize:\n- Background images\n- Color schemes\n- Font preferences\n\n### Content Management\nEasy-to-use admin interface for:\n- Creating and editing posts\n- Managing comments\n- Viewing analytics\n- Publishing/unpublishing content\n\nThis project proves that vanilla JavaScript is still powerful and relevant in modern web development!', 'https://www.youtube.com/watch?v=hdI2bqOjy3c', true, 'building-this-blog-technical-deep-dive', 67)
            `;
            console.log('Sample posts created successfully');
        }

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
        // We don't exit process here, just log error, so server can still try to start
        // process.exit(1);
    }
};

module.exports = initializeDatabase;
