const { client } = require('../config/database');
const logActivity = require('../utils/activityLogger'); // Not used directly but good for consistency

const getDashboardData = async (req, res) => {
    try {
        console.log('Analytics API called by user:', req.user?.email);
        const { startDate, endDate } = req.query;

        let totalVisits;
        if (startDate && endDate) {
            totalVisits = await client`SELECT COUNT(*) as count FROM analytics WHERE event_type = 'post_view' AND timestamp >= ${startDate} AND timestamp <= ${endDate}`;
        } else {
            totalVisits = await client`SELECT COUNT(*) as count FROM analytics WHERE event_type = 'post_view'`;
        }

        const mostViewed = await client`
            SELECT p.title, p.views, p.id 
            FROM posts p 
            ORDER BY p.views DESC 
            LIMIT 10
        `;

        const mostWatched = await client`
            SELECT p.title, COUNT(a.id) as play_count, p.id
            FROM posts p 
            LEFT JOIN analytics a ON p.id = a.post_id AND a.event_type = 'video_play'
            WHERE p.youtube_url IS NOT NULL
            GROUP BY p.id, p.title
            ORDER BY play_count DESC
            LIMIT 10
        `;

        // Daily analytics logic
        let dailyQuery;
        if (startDate && endDate) {
            dailyQuery = client`
                SELECT DATE(timestamp) as date, COUNT(*) as visits 
                FROM analytics 
                WHERE event_type = 'post_view' AND timestamp >= ${startDate} AND timestamp <= ${endDate}
                GROUP BY DATE(timestamp) 
                ORDER BY date ASC
            `;
        } else {
            dailyQuery = client`
                SELECT DATE(timestamp) as date, COUNT(*) as visits 
                FROM analytics 
                WHERE event_type = 'post_view' AND timestamp >= NOW() - INTERVAL '30 days'
                GROUP BY DATE(timestamp) 
                ORDER BY date ASC
            `;
        }

        const dailyAnalytics = await dailyQuery;

        // Calculate average time spent
        const avgTimeQuery = startDate && endDate
            ? client`SELECT AVG((additional_data->>'timeSpent')::int) as avg_time FROM analytics WHERE event_type = 'time_on_page' AND timestamp >= ${startDate} AND timestamp <= ${endDate}`
            : client`SELECT AVG((additional_data->>'timeSpent')::int) as avg_time FROM analytics WHERE event_type = 'time_on_page'`;

        const avgTimeResult = await avgTimeQuery;
        const avgTimeSpent = Math.round(avgTimeResult[0].avg_time || 0);

        res.json({
            totalVisits: parseInt(totalVisits[0].count),
            mostViewed,
            mostWatched,
            dailyAnalytics,
            avgTimeSpent
        });
    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const trackEvent = async (req, res) => {
    try {
        const { eventType, postId, sessionId, additionalData } = req.body;
        const userAgent = req.headers['user-agent'];
        const ipAddress = req.ip;

        await client`
            INSERT INTO analytics (event_type, post_id, session_id, user_agent, ip_address, additional_data) 
            VALUES (${eventType}, ${postId}, ${sessionId}, ${userAgent}, ${ipAddress}, ${JSON.stringify(additionalData)})
        `;

        res.json({ success: true });
    } catch (error) {
        console.error('Track event error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getMacBans = async (req, res) => {
    // Implementing MAC Bans API from admin.js references
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const bans = await client`SELECT * FROM mac_bans ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
        const total = await client`SELECT COUNT(*) as count FROM mac_bans`;

        res.json({
            bans,
            total: parseInt(total[0].count),
            page: parseInt(page),
            totalPages: Math.ceil(total[0].count / limit)
        });
    } catch (error) {
        console.error('Get MAC bans error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Activity Logs endpoint for admin
const getActivityLogs = async (req, res) => {
    try {
        const { page = 1, limit = 20, action, entity_type, user_email } = req.query;
        const offset = (page - 1) * limit;

        // Build query conditions
        let conditions = [];
        if (action) conditions.push(client`action = ${action}`);
        if (entity_type) conditions.push(client`entity_type = ${entity_type}`);
        if (user_email) conditions.push(client`user_email ILIKE ${'%' + user_email + '%'}`);

        let whereClause = client``;
        if (conditions.length > 0) {
            whereClause = client`WHERE ${conditions.reduce((acc, curr, i) => i === 0 ? curr : client`${acc} AND ${curr}`, client``)}`;
        }

        // Combine for full query
        // Note: postgres.js template literals composition
        const logs = await client`SELECT * FROM activity_logs ${whereClause} ORDER BY timestamp DESC LIMIT ${limit} OFFSET ${offset}`;
        const total = await client`SELECT COUNT(*) as count FROM activity_logs ${whereClause}`;

        res.json({
            logs,
            total: parseInt(total[0].count),
            page: parseInt(page),
            totalPages: Math.ceil(total[0].count / limit)
        });
    } catch (error) {
        console.error('Get activity logs error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getActivityStats = async (req, res) => {
    try {
        const totalResult = await client`SELECT COUNT(*) as count FROM activity_logs`;
        const actionStats = await client`SELECT action, COUNT(*) as count FROM activity_logs GROUP BY action`;

        res.json({
            totalLogs: parseInt(totalResult[0].count),
            actionStats: actionStats.map(s => ({ action: s.action, count: parseInt(s.count) }))
        });
    } catch (error) {
        console.error('Get activity stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Per-post statistics endpoint for admin
const getPostStats = async (req, res) => {
    try {
        const { postId } = req.params;

        // Get post details
        const postResult = await client`SELECT * FROM posts WHERE id = ${postId}`;
        if (postResult.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        const post = postResult[0];

        // Total views
        const viewsResult = await client`
            SELECT COUNT(*) as count FROM analytics 
            WHERE post_id = ${postId} AND event_type = 'post_view'
        `;
        const totalViews = parseInt(viewsResult[0].count);

        // Video plays
        const playsResult = await client`
            SELECT COUNT(*) as count FROM analytics 
            WHERE post_id = ${postId} AND event_type = 'video_play'
        `;
        const videoPlays = parseInt(playsResult[0].count);

        // Comments count
        const commentsResult = await client`
            SELECT COUNT(*) as count FROM comments 
            WHERE post_id = ${postId}
        `;
        const commentsCount = parseInt(commentsResult[0].count);

        // Daily views (last 30 days)
        const dailyViews = await client`
            SELECT DATE(timestamp) as date, COUNT(*) as views
            FROM analytics
            WHERE post_id = ${postId} AND event_type = 'post_view'
              AND timestamp >= NOW() - INTERVAL '30 days'
            GROUP BY DATE(timestamp)
            ORDER BY date ASC
        `;

        // Hourly view distribution
        const hourlyViews = await client`
            SELECT EXTRACT(HOUR FROM timestamp)::int as hour, COUNT(*) as views
            FROM analytics
            WHERE post_id = ${postId} AND event_type = 'post_view'
            GROUP BY EXTRACT(HOUR FROM timestamp)
            ORDER BY hour ASC
        `;

        // Browser stats
        const browserStats = await client`
            SELECT 
                CASE 
                    WHEN user_agent LIKE '%Edg%' THEN 'Edge'
                    WHEN user_agent LIKE '%Chrome%' THEN 'Chrome'
                    WHEN user_agent LIKE '%Firefox%' THEN 'Firefox'
                    WHEN user_agent LIKE '%Safari%' THEN 'Safari'
                    WHEN user_agent LIKE '%Opera%' OR user_agent LIKE '%OPR%' THEN 'Opera'
                    ELSE 'Other'
                END as browser,
                COUNT(*) as count
            FROM analytics
            WHERE post_id = ${postId} AND event_type = 'post_view'
            GROUP BY browser
            ORDER BY count DESC
            LIMIT 5
        `;

        // Recent activity (last 20 events)
        const recentActivity = await client`
            SELECT event_type, timestamp, user_agent, ip_address
            FROM analytics
            WHERE post_id = ${postId}
            ORDER BY timestamp DESC
            LIMIT 20
        `;

        res.json({
            post,
            totalViews,
            videoPlays,
            commentsCount,
            dailyViews,
            hourlyViews,
            browserStats,
            recentActivity
        });
    } catch (error) {
        console.error('Get post stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getDashboardData,
    trackEvent,
    getActivityLogs,
    getActivityStats,
    getMacBans,
    getPostStats
};
