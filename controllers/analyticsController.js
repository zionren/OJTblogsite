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
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const logs = await client`SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT ${limit} OFFSET ${offset}`;
        const total = await client`SELECT COUNT(*) as count FROM activity_logs`;

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


module.exports = {
    getDashboardData,
    trackEvent,
    getActivityLogs,
    getMacBans
};
