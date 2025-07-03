const { pgTable, serial, varchar, text, timestamp, boolean, integer, inet, jsonb } = require('drizzle-orm/pg-core');

const posts = pgTable('posts', {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    content: text('content').notNull(),
    youtube_url: varchar('youtube_url', { length: 500 }),
    created_at: timestamp('created_at').defaultNow(),
    updated_at: timestamp('updated_at').defaultNow(),
    published: boolean('published').default(true),
    views: integer('views').default(0),
    slug: varchar('slug', { length: 255 }).unique()
});

const analytics = pgTable('analytics', {
    id: serial('id').primaryKey(),
    event_type: varchar('event_type', { length: 50 }).notNull(),
    post_id: integer('post_id').references(() => posts.id),
    session_id: varchar('session_id', { length: 100 }),
    user_agent: text('user_agent'),
    ip_address: inet('ip_address'),
    timestamp: timestamp('timestamp').defaultNow(),
    additional_data: jsonb('additional_data')
});

const comments = pgTable('comments', {
    id: serial('id').primaryKey(),
    post_id: integer('post_id').references(() => posts.id),
    author_name: varchar('author_name', { length: 100 }).notNull(),
    content: text('content').notNull(),
    created_at: timestamp('created_at').defaultNow(),
    approved: boolean('approved').default(true)
});

const users = pgTable('users', {
    id: serial('id').primaryKey(),
    email: varchar('email', { length: 255 }).unique().notNull(),
    password_hash: varchar('password_hash', { length: 255 }).notNull(),
    role: varchar('role', { length: 50 }).default('admin'),
    created_at: timestamp('created_at').defaultNow()
});

module.exports = {
    posts,
    analytics,
    comments,
    users
};
