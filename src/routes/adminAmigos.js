const express = require('express');
const router = express.Router();
const AmigosAdminService = require('../services/AmigosAdminService');
const AmigosService = require('../services/AmigosService');

// All routes here should be protected by requireAdmin in server.js

router.get('/campaign', async (req, res) => {
    try {
        const campaign = await AmigosService.getActiveCampaign();
        res.json(campaign || {}); // Return empty obj if null to avoid client error
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Diagnostic endpoint
router.get('/debug', async (req, res) => {
    try {
        const { query } = require('../database/db');

        // Get all campaigns
        const campaigns = await query('SELECT id, name, is_active, start_number, end_number FROM az_campaigns ORDER BY id');

        // Get active campaign
        const active = await AmigosService.getActiveCampaign();

        // Count available tickets per campaign
        const ticketCounts = await query(`
            SELECT campaign_id, status, COUNT(*) as count 
            FROM az_tickets 
            GROUP BY campaign_id, status
        `);

        // Total tickets
        const totalTickets = await query('SELECT COUNT(*) as total FROM az_tickets');

        res.json({
            campaigns: campaigns.rows,
            active_campaign: active,
            ticket_counts: ticketCounts.rows,
            total_tickets: totalTickets.rows[0].total
        });
    } catch (e) {
        res.status(500).json({ error: e.message, stack: e.stack });
    }
});

router.post('/campaign', async (req, res) => {
    try {
        const { name, start_number, end_number, config } = req.body;
        let campaign = await AmigosService.getActiveCampaign();

        if (campaign) {
            campaign = await AmigosAdminService.updateCampaign(campaign.id, {
                name, start_number, end_number, base_qty_config: config,
                is_active: req.body.is_active // Add this
            });
        } else {
            campaign = await AmigosAdminService.createCampaign({
                name, start_number, end_number, base_qty_config: config,
                is_active: req.body.is_active // Add this
            });
        }
        res.json(campaign);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/campaign/tickets', async (req, res) => {
    try {
        const { campaignId } = req.body;
        console.log('[AdminAmigos] Initializing tickets for campaign:', campaignId);

        if (!campaignId) {
            // If no campaignId provided, get active campaign
            const campaign = await AmigosService.getActiveCampaign();
            if (!campaign) {
                return res.status(400).json({ error: 'Nenhuma campanha ativa encontrada' });
            }
            console.log('[AdminAmigos] Using active campaign:', campaign.id, campaign.name);
            await AmigosService.populateTickets(campaign.id);
            res.json({ success: true, message: `Tickets do ${campaign.start_number} ao ${campaign.end_number} inicializados!` });
        } else {
            await AmigosService.populateTickets(campaignId);
            res.json({ success: true, message: 'Tickets populated' });
        }
    } catch (e) {
        console.error('[AdminAmigos] Error initializing tickets:', e);
        res.status(500).json({ error: e.message });
    }
});

router.get('/promotions', async (req, res) => {
    try {
        const campaign = await AmigosService.getActiveCampaign();
        if (!campaign) return res.json([]);
        const promos = await AmigosAdminService.getPromotions(campaign.id);
        res.json(promos);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/promotions', async (req, res) => {
    try {
        const { name, extra_qty, starts_at, ends_at, image_url } = req.body;
        const campaign = await AmigosService.getActiveCampaign();
        if (!campaign) throw new Error('No active campaign');

        const promo = await AmigosAdminService.createPromotion(campaign.id, {
            name, extra_qty, starts_at, ends_at, image_url
        });
        res.json(promo);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/promotions/:id', async (req, res) => {
    try {
        const promo = await AmigosAdminService.updatePromotion(req.params.id, req.body);
        res.json(promo);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/promotions/:id', async (req, res) => {
    try {
        await AmigosAdminService.deletePromotion(req.params.id);
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// Image Upload Configuration
const multer = require('multer');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const fs = require('fs');
        const path = require('path');
        const dir = path.join(__dirname, '../../public/uploads');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir)
    },
    filename: function (req, file, cb) {
        const ext = file.originalname.split('.').pop();
        cb(null, 'promo-' + Date.now() + '.' + ext)
    }
});
const upload = multer({ storage: storage });

router.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    // Return relative URL
    res.json({ url: '/uploads/' + req.file.filename });
});

router.post('/promotions/:id/token', async (req, res) => {
    try {
        const token = await AmigosAdminService.generatePromoToken(req.params.id);
        // Return full link
        // Assuming host from req or config
        const host = req.headers.host;
        const link = `${req.protocol}://${host}/amigos-do-zapao?p=${token}`;

        res.json({ token, link });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/search', async (req, res) => {
    try {
        const { term } = req.query;
        if (!term) return res.status(400).json({ error: 'Term required' });

        const result = await AmigosAdminService.searchParticipant(term);
        res.json(result || { found: false });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
