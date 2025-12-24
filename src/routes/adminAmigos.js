const express = require('express');
const router = express.Router();
const AmigosAdminService = require('../services/AmigosAdminService');
const AmigosService = require('../services/AmigosService');

// All routes here should be protected by requireAdmin in server.js

router.get('/campaign', async (req, res) => {
    try {
        const campaign = await AmigosService.getActiveCampaign();
        res.json(campaign);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/campaign/tickets', async (req, res) => {
    try {
        const { campaignId } = req.body;
        await AmigosService.populateTickets(campaignId);
        res.json({ success: true, message: 'Tickets populated' });
    } catch (e) {
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
