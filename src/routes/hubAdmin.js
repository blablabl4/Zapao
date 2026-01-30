const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const GroupHubService = require('../services/GroupHubService');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Multer config for memory storage (for Cloudinary upload)
const upload = multer({ storage: multer.memoryStorage() });

// Configure Cloudinary
const CLOUDINARY_CONFIGURED = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
if (CLOUDINARY_CONFIGURED) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
}

// Banner Upload Endpoint (using Cloudinary)
router.post('/banner', upload.single('banner'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        }

        if (!CLOUDINARY_CONFIGURED) {
            return res.status(500).json({ error: 'Cloudinary não configurado. Adicione as variáveis no Railway.' });
        }

        // Convert buffer to base64
        const dataURI = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(dataURI, {
            folder: 'hub',
            public_id: 'hub-banner',
            overwrite: true
        });

        // Save URL to database config
        await query(`
            INSERT INTO hub_config (key, value) VALUES ('banner_url', $1)
            ON CONFLICT (key) DO UPDATE SET value = $1
        `, [result.secure_url]);

        res.json({ success: true, url: result.secure_url });
    } catch (e) {
        console.error('Banner upload error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Get Config (for public /hub page)
router.get('/config', async (req, res) => {
    try {
        const result = await query(`SELECT key, value FROM hub_config`);
        const config = {
            active: true,
            banner_url: null,
            title: 'Entre para o Grupo VIP'
        };

        for (const row of result.rows) {
            if (row.key === 'banner_url') config.banner_url = row.value;
            if (row.key === 'title') config.title = row.value;
            if (row.key === 'active') config.active = row.value === 'true';
        }

        res.json(config);
    } catch (e) {
        // If table doesn't exist, return defaults
        res.json({ active: true, banner_url: null, title: 'Entre para o Grupo VIP' });
    }
});


// Stats / KPIs
router.get('/stats', async (req, res) => {
    try {
        const stats = {
            total_leads: 0,
            active_groups: 0,
            bot_connected: false,
            total_clicks: 0,
            conversion_rate: 0,
            confirmed_members: 0
        };

        const resLeads = await query('SELECT COUNT(*) FROM leads');
        stats.total_leads = parseInt(resLeads.rows[0].count);

        const resGroups = await query('SELECT COUNT(*) FROM whatsapp_groups WHERE active = true');
        stats.active_groups = parseInt(resGroups.rows[0].count);

        // Click tracking
        try {
            const resClicks = await query('SELECT COUNT(*) FROM hub_clicks');
            stats.total_clicks = parseInt(resClicks.rows[0].count);

            // Conversion rate (leads / clicks * 100)
            if (stats.total_clicks > 0) {
                stats.conversion_rate = Math.round((stats.total_leads / stats.total_clicks) * 100);
            }
        } catch (e) {
            // Table might not exist yet
        }

        // Confirmed members (status = ACTIVE)
        try {
            const resActive = await query(`SELECT COUNT(*) FROM leads WHERE status = 'ACTIVE'`);
            stats.confirmed_members = parseInt(resActive.rows[0].count);
        } catch (e) { }

        // Check Bot
        stats.bot_connected = global.botStatus === 'connected';

        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Group Management
router.get('/groups', async (req, res) => {
    try {
        const result = await query('SELECT * FROM whatsapp_groups ORDER BY id ASC');
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/groups', async (req, res) => {
    try {
        const { name, invite_link, capacity } = req.body;
        await GroupHubService.createGroup(name, invite_link, capacity);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/groups/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, invite_link, capacity, active } = req.body;

        await query(
            `UPDATE whatsapp_groups 
             SET name = COALESCE($1, name), 
                 invite_link = COALESCE($2, invite_link), 
                 capacity = COALESCE($3, capacity),
                 active = COALESCE($4, active)
             WHERE id = $5`,
            [name, invite_link, capacity, active, id]
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Bot Control
router.get('/bot/status', (req, res) => {
    res.json({
        status: global.botStatus || 'disconnected',
        connected: global.botStatus === 'connected',
        qr_available: global.botStatus === 'qr_ready'
    });
});

router.get('/bot/qr', (req, res) => {
    if (global.botQR) {
        res.json({ qr: global.botQR });
    } else if (global.botStatus === 'connected') {
        res.json({ error: 'Já conectado', status: 'connected' });
    } else {
        res.json({ error: 'QR não disponível. Inicie o bot primeiro.', status: global.botStatus });
    }
});

router.post('/bot/start', async (req, res) => {
    try {
        const { startBot } = require('../bot/index');
        // If already running, maybe restart or just return
        if (!global.whatsappSocket || global.botStatus === 'disconnected') {
            await startBot();
        }
        res.json({ success: true, message: 'Bot initiation requested' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Sync all groups and validate members
router.post('/bot/sync-members', async (req, res) => {
    try {
        if (!global.groupMonitor) {
            return res.status(400).json({ error: 'Bot não está conectado. Inicie o robô primeiro.' });
        }

        console.log('[HubAdmin] Starting full member sync...');
        const results = await global.groupMonitor.syncAllMembers();

        res.json({
            success: true,
            message: 'Sincronização completa!',
            ...results
        });
    } catch (e) {
        console.error('[HubAdmin] Sync error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Leads Table (with search and pagination)
router.get('/leads', async (req, res) => {
    try {
        const { search, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = '';
        let params = [limit, offset];

        if (search) {
            whereClause = `WHERE l.name ILIKE $3 OR l.phone ILIKE $3`;
            params.push(`%${search}%`);
        }

        const result = await query(`
            SELECT l.*, g.name as group_name,
                   (SELECT COUNT(*) FROM leads WHERE referrer_id = l.id) as referral_count
            FROM leads l
            LEFT JOIN whatsapp_groups g ON l.assigned_group_id = g.id
            ${whereClause}
            ORDER BY l.created_at DESC
            LIMIT $1 OFFSET $2
        `, params);

        // Get total count
        const countResult = await query(`SELECT COUNT(*) FROM leads`);

        res.json({
            leads: result.rows,
            total: parseInt(countResult.rows[0].count),
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Top Affiliates Ranking
router.get('/affiliates/ranking', async (req, res) => {
    try {
        const result = await query(`
            SELECT l.id, l.name, l.phone, l.affiliate_token, l.created_at,
                   COUNT(refs.id) as referral_count
            FROM leads l
            LEFT JOIN leads refs ON refs.referrer_id = l.id
            GROUP BY l.id, l.name, l.phone, l.affiliate_token, l.created_at
            HAVING COUNT(refs.id) > 0
            ORDER BY referral_count DESC
            LIMIT 20
        `);

        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Analytics: Stats by Period
router.get('/analytics/period', async (req, res) => {
    try {
        const { period = '7d' } = req.query;
        let interval = '7 days';
        if (period === '1d') interval = '1 day';
        if (period === '30d') interval = '30 days';
        if (period === 'all') interval = '10 years';

        const stats = {};

        // Leads by period
        const leadsRes = await query(`
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM leads
            WHERE created_at >= NOW() - INTERVAL '${interval}'
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);
        stats.leads_by_day = leadsRes.rows;

        // Clicks by period
        try {
            const clicksRes = await query(`
                SELECT DATE(created_at) as date, COUNT(*) as count
                FROM hub_clicks
                WHERE created_at >= NOW() - INTERVAL '${interval}'
                GROUP BY DATE(created_at)
                ORDER BY date ASC
            `);
            stats.clicks_by_day = clicksRes.rows;
        } catch (e) {
            stats.clicks_by_day = [];
        }

        // Totals for period
        const totalLeads = await query(`SELECT COUNT(*) FROM leads WHERE created_at >= NOW() - INTERVAL '${interval}'`);
        stats.total_leads_period = parseInt(totalLeads.rows[0].count);

        try {
            const totalClicks = await query(`SELECT COUNT(*) FROM hub_clicks WHERE created_at >= NOW() - INTERVAL '${interval}'`);
            stats.total_clicks_period = parseInt(totalClicks.rows[0].count);
        } catch (e) {
            stats.total_clicks_period = 0;
        }

        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Analytics: Per Affiliate Performance
router.get('/analytics/affiliate/:token', async (req, res) => {
    try {
        const { token } = req.params;

        // Get affiliate info
        const affiliateRes = await query(`SELECT * FROM leads WHERE affiliate_token = $1`, [token]);
        if (affiliateRes.rows.length === 0) {
            return res.status(404).json({ error: 'Afiliado não encontrado' });
        }
        const affiliate = affiliateRes.rows[0];

        // Count referrals
        const referralsRes = await query(`SELECT COUNT(*) FROM leads WHERE referrer_id = $1`, [affiliate.id]);

        // Count clicks
        let clicks = 0;
        try {
            const clicksRes = await query(`SELECT COUNT(*) FROM hub_clicks WHERE affiliate_token = $1`, [token]);
            clicks = parseInt(clicksRes.rows[0].count);
        } catch (e) { }

        // Get referral list
        const referralListRes = await query(`
            SELECT name, phone, status, created_at 
            FROM leads 
            WHERE referrer_id = $1 
            ORDER BY created_at DESC
        `, [affiliate.id]);

        res.json({
            affiliate: {
                name: affiliate.name,
                phone: affiliate.phone,
                token: affiliate.affiliate_token,
                created_at: affiliate.created_at
            },
            clicks,
            referrals: parseInt(referralsRes.rows[0].count),
            conversion_rate: clicks > 0 ? Math.round((parseInt(referralsRes.rows[0].count) / clicks) * 100) : 0,
            referral_list: referralListRes.rows
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Analytics: Peak Hours
router.get('/analytics/peak-hours', async (req, res) => {
    try {
        // Leads by hour
        const leadsRes = await query(`
            SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count
            FROM leads
            WHERE created_at >= NOW() - INTERVAL '30 days'
            GROUP BY EXTRACT(HOUR FROM created_at)
            ORDER BY hour
        `);

        // Clicks by hour
        let clicksByHour = [];
        try {
            const clicksRes = await query(`
                SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count
                FROM hub_clicks
                WHERE created_at >= NOW() - INTERVAL '30 days'
                GROUP BY EXTRACT(HOUR FROM created_at)
                ORDER BY hour
            `);
            clicksByHour = clicksRes.rows;
        } catch (e) { }

        res.json({
            leads_by_hour: leadsRes.rows,
            clicks_by_hour: clicksByHour
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Analytics: Device Stats
router.get('/analytics/devices', async (req, res) => {
    try {
        let deviceStats = { mobile: 0, desktop: 0, other: 0 };

        try {
            const result = await query(`SELECT user_agent FROM hub_clicks`);
            for (const row of result.rows) {
                const ua = (row.user_agent || '').toLowerCase();
                if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
                    deviceStats.mobile++;
                } else if (ua.includes('windows') || ua.includes('macintosh') || ua.includes('linux')) {
                    deviceStats.desktop++;
                } else {
                    deviceStats.other++;
                }
            }
        } catch (e) { }

        const total = deviceStats.mobile + deviceStats.desktop + deviceStats.other;
        res.json({
            mobile: deviceStats.mobile,
            desktop: deviceStats.desktop,
            other: deviceStats.other,
            mobile_pct: total > 0 ? Math.round((deviceStats.mobile / total) * 100) : 0,
            desktop_pct: total > 0 ? Math.round((deviceStats.desktop / total) * 100) : 0
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Analytics: Exit Rate (users who left groups)
router.get('/analytics/exit-rate', async (req, res) => {
    try {
        const totalRes = await query(`SELECT COUNT(*) FROM leads`);
        const leftRes = await query(`SELECT COUNT(*) FROM leads WHERE status = 'LEFT'`);

        const total = parseInt(totalRes.rows[0].count);
        const left = parseInt(leftRes.rows[0].count);

        res.json({
            total_leads: total,
            left_group: left,
            exit_rate: total > 0 ? Math.round((left / total) * 100) : 0
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Analytics: Top Affiliates with LTV (Lifetime Value)
router.get('/analytics/affiliate-ltv', async (req, res) => {
    try {
        const result = await query(`
            SELECT l.id, l.name, l.phone, l.affiliate_token, l.created_at,
                   COUNT(refs.id) as referral_count,
                   MIN(refs.created_at) as first_referral,
                   MAX(refs.created_at) as last_referral
            FROM leads l
            LEFT JOIN leads refs ON refs.referrer_id = l.id
            GROUP BY l.id, l.name, l.phone, l.affiliate_token, l.created_at
            HAVING COUNT(refs.id) > 0
            ORDER BY referral_count DESC
            LIMIT 50
        `);

        // Add clicks data
        const affiliatesWithClicks = [];
        for (const aff of result.rows) {
            let clicks = 0;
            try {
                const clicksRes = await query(`SELECT COUNT(*) FROM hub_clicks WHERE affiliate_token = $1`, [aff.affiliate_token]);
                clicks = parseInt(clicksRes.rows[0].count);
            } catch (e) { }

            affiliatesWithClicks.push({
                ...aff,
                clicks,
                conversion_rate: clicks > 0 ? Math.round((aff.referral_count / clicks) * 100) : 0
            });
        }

        res.json(affiliatesWithClicks);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Surveys Data
router.get('/surveys', async (req, res) => {
    try {
        const result = await query(`
            SELECT * FROM hub_surveys ORDER BY created_at DESC
        `);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
