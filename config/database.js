const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
require('dotenv').config();

// Database setup
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('DATABASE_URL environment variable is required');
    // We don't exit here to allow tests/builds to run without DB if needed, 
    // but the app will fail when trying to query.
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
        // We throw here because if we can't connect, the app is useless
        throw new Error('Database connection failed');
    }
}

const db = drizzle(client);

module.exports = {
    db,
    client
};
