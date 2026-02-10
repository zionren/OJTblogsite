const { client } = require('../config/database');

async function logActivity(userId, userEmail, action, entityType, entityId, details, req) {
    try {
        // Handle cases where req might not be passed or is partial
        const ip_address = req?.ip || req?.connection?.remoteAddress || 'unknown';
        const user_agent = req?.headers?.['user-agent'] || 'unknown';

        await client`
            INSERT INTO activity_logs (user_id, user_email, action, entity_type, entity_id, details, ip_address, user_agent)
            VALUES (${userId}, ${userEmail}, ${action}, ${entityType}, ${entityId}, ${JSON.stringify(details)}, ${ip_address}, ${user_agent})
        `;
        // Optional: console.log for dev
        if (process.env.NODE_ENV !== 'production') {
            console.log(`Activity logged: ${action} on ${entityType} by ${userEmail}`);
        }
    } catch (error) {
        console.error('Error logging activity:', error);
    }
}

module.exports = logActivity;
