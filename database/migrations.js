const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const client = postgres(connectionString);

const runMigrations = async () => {
    try {
        console.log('Running database migrations...');
        
        // Create posts table
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

        // Create analytics table
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

        // Create comments table
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

        // Create users table
        await client`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'admin',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // Create MAC bans table
        await client`
            CREATE TABLE IF NOT EXISTS mac_bans (
                id SERIAL PRIMARY KEY,
                mac_address VARCHAR(17) NOT NULL,
                reason TEXT,
                banned_by VARCHAR(255),
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // Create indexes
        await client`CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug)`;
        await client`CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics(event_type)`;
        await client`CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics(timestamp)`;
        await client`CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id)`;
        await client`CREATE INDEX IF NOT EXISTS idx_mac_bans_mac_address ON mac_bans(mac_address)`;
        await client`CREATE INDEX IF NOT EXISTS idx_mac_bans_is_active ON mac_bans(is_active)`;

        console.log('Database migrations completed successfully');
    } catch (error) {
        console.error('Migration error:', error);
        throw error;
    } finally {
        await client.end();
    }
};

if (require.main === module) {
    runMigrations();
}

module.exports = { runMigrations };
