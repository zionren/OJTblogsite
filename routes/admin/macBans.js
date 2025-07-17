// MAC address banning is no longer being used in this application. This is a feature
// that is now trashed due to difficulties.
const express = require('express');
const router = express.Router();
const postgres = require('postgres');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const client = postgres(connectionString);

// Get all MAC bans with pagination and filtering
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        
        const { status, search } = req.query;
        
        let whereConditions = [];
        
        if (status === 'active') {
            whereConditions.push('expires_at IS NULL OR expires_at > NOW()');
        } else if (status === 'inactive') {
            whereConditions.push('expires_at IS NOT NULL AND expires_at <= NOW()');
        }
        
        if (search) {
            whereConditions.push(`mac_address ILIKE '%${search}%'`);
        }
        
        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
        
        // Get total count
        const countQuery = whereConditions.length > 0 
            ? client.unsafe(`SELECT COUNT(*) as total FROM mac_bans ${whereClause}`)
            : client`SELECT COUNT(*) as total FROM mac_bans`;
        
        const countResult = await countQuery;
        const totalBans = parseInt(countResult[0].total);
        
        // Get paginated results
        const bansQuery = whereConditions.length > 0
            ? client.unsafe(`
                SELECT id, mac_address, reason, created_at,
                       CASE WHEN expires_at IS NULL OR expires_at > NOW() THEN true ELSE false END as is_active,
                       'System' as banned_by
                FROM mac_bans 
                ${whereClause}
                ORDER BY created_at DESC 
                LIMIT ${limit} OFFSET ${offset}
            `)
            : client`
                SELECT id, mac_address, reason, created_at,
                       CASE WHEN expires_at IS NULL OR expires_at > NOW() THEN true ELSE false END as is_active,
                       'System' as banned_by
                FROM mac_bans 
                ORDER BY created_at DESC 
                LIMIT ${limit} OFFSET ${offset}
            `;
        
        const bans = await bansQuery;
        
        const totalPages = Math.ceil(totalBans / limit);
        
        res.json({
            bans,
            pagination: {
                currentPage: page,
                totalPages,
                totalBans,
                limit
            }
        });
    } 
    catch (error) {
        console.error('Error fetching MAC bans:', error);
        res.status(500).json({ error: 'Failed to fetch MAC bans' });
    }
});

// Get MAC bans statistics
router.get('/stats', async (req, res) => {
    try {
        // Total bans
        const totalResult = await client`SELECT COUNT(*) as count FROM mac_bans`;
        const totalBans = parseInt(totalResult[0].count);
        
        // Active bans (not expired)
        const activeResult = await client`
            SELECT COUNT(*) as count 
            FROM mac_bans 
            WHERE expires_at IS NULL OR expires_at > NOW()
        `;
        const activeBans = parseInt(activeResult[0].count);
        
        // Today's bans
        const todayResult = await client`
            SELECT COUNT(*) as count 
            FROM mac_bans 
            WHERE DATE(created_at) = CURRENT_DATE
        `;
        const todayBans = parseInt(todayResult[0].count);
        
        // Blocked attempts (placeholder for now)
        const blockedAttempts = 0;
        
        res.json({
            totalBans,
            activeBans,
            todayBans,
            blockedAttempts
        });
    } catch (error) {
        console.error('Error fetching MAC bans stats:', error);
        res.status(500).json({ error: 'Failed to fetch MAC bans statistics' });
    }
});

// Add new MAC ban
router.post('/', async (req, res) => {
    try {
        const { mac_address, reason } = req.body;
        
        if (!mac_address) {
            return res.status(400).json({ error: 'MAC address is required' });
        }
        
        // Validate MAC address format
        const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
        if (!macRegex.test(mac_address)) {
            return res.status(400).json({ error: 'Invalid MAC address format' });
        }
        
        // Check if MAC address is already banned
        const existing = await client`
            SELECT id FROM mac_bans 
            WHERE mac_address = ${mac_address} 
            AND (expires_at IS NULL OR expires_at > NOW())
        `;
        
        if (existing.length > 0) {
            return res.status(400).json({ error: 'MAC address is already banned' });
        }
        
        // Insert new ban (permanent ban - no expiry)
        const result = await client`
            INSERT INTO mac_bans (mac_address, reason, created_at) 
            VALUES (${mac_address}, ${reason || null}, NOW()) 
            RETURNING *
        `;
        
        res.status(201).json({
            id: result[0].id,
            mac_address: result[0].mac_address,
            reason: result[0].reason,
            banned_by: 'System',
            is_active: true,
            created_at: result[0].created_at
        });
    } catch (error) {
        console.error('Error adding MAC ban:', error);
        res.status(500).json({ error: 'Failed to add MAC ban' });
    }
});

// Remove MAC ban
router.delete('/:id', async (req, res) => {
    try {
        const banId = req.params.id;
        
        // Check if ban exists
        const ban = await client`SELECT * FROM mac_bans WHERE id = ${banId}`;
        if (ban.length === 0) {
            return res.status(404).json({ error: 'MAC ban not found' });
        }
        
        // Delete the ban
        await client`DELETE FROM mac_bans WHERE id = ${banId}`;
        
        res.json({ message: 'MAC ban removed successfully' });
    } catch (error) {
        console.error('Error removing MAC ban:', error);
        res.status(500).json({ error: 'Failed to remove MAC ban' });
    }
});

module.exports = router;