const express = require('express');
const router = express.Router();
const NotificationService = require('../services/NotificationService');
const RemarketingService = require('../services/RemarketingService');
const { requireAdmin } = require('../middleware/adminAuth');
const { query } = require('../database/db');

/**
 * POST /api/marketing/subscribe
 * Save a user's push subscription (PUBLIC - no auth required)
 */
router.post('/subscribe', async (req, res) => {
    try {
        const { subscription, phone } = req.body;
        const userId = req.session?.userId || null;
        const userAgent = req.headers['user-agent'];

        await NotificationService.subscribe(subscription, userId, userAgent);

        // If phone provided, link subscription to phone number
        if (phone) {
            const cleanPhone = phone.replace(/\D/g, '');
            await query(`
                UPDATE push_subscriptions 
                SET phone = $1 
                WHERE endpoint = $2
            `, [cleanPhone, subscription.endpoint]);
        }

        res.json({ success: true });
    } catch (e) {
        console.error('Subscribe Error:', e);
        res.status(500).json({ error: 'Failed to subscribe' });
    }
});

/**
 * POST /api/marketing/track-click
 * Track notification click (PUBLIC - called from SW)
 */
router.post('/track-click', async (req, res) => {
    try {
        const { campaignId, endpoint } = req.body;
        if (campaignId && endpoint) {
            await RemarketingService.logClick(campaignId, endpoint);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ========== ADMIN ROUTES ==========

/**
 * GET /api/marketing/metrics
 * Get overall marketing metrics
 */
router.get('/metrics', requireAdmin, async (req, res) => {
    try {
        const metrics = await RemarketingService.getMetrics();
        res.json(metrics);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/marketing/segments
 * Get available segments with counts
 */
router.get('/segments', requireAdmin, async (req, res) => {
    try {
        const [all, inactive, abandoned, winners, lowTickets] = await Promise.all([
            RemarketingService.getAllSubscriptions(),
            RemarketingService.getInactiveInCurrentRaffle(),
            RemarketingService.getAbandonedCarts(),
            RemarketingService.getPreviousWinners(),
            RemarketingService.getLowTicketBuyers()
        ]);

        res.json({
            segments: [
                { id: 'all', name: 'Todos Inscritos', count: all.length },
                { id: 'inactive', name: 'Inativos na Rifa Atual', count: inactive.length },
                { id: 'abandoned', name: 'Carrinho Abandonado', count: abandoned.length },
                { id: 'winners', name: 'Ganhadores Anteriores', count: winners.length },
                { id: 'low_tickets', name: 'Poucos Números (1-5)', count: lowTickets.length }
            ]
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/marketing/campaigns
 * List all campaigns
 */
router.get('/campaigns', requireAdmin, async (req, res) => {
    try {
        const result = await query(`
            SELECT * FROM campaigns 
            ORDER BY created_at DESC 
            LIMIT 50
        `);
        res.json({ campaigns: result.rows });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/marketing/campaign
 * Create a new campaign
 */
router.post('/campaign', requireAdmin, async (req, res) => {
    try {
        const { name, title, body, url, affiliateCode, segment, scheduledAt } = req.body;

        if (!name || !title || !body) {
            return res.status(400).json({ error: 'Nome, título e mensagem são obrigatórios' });
        }

        const campaign = await RemarketingService.createCampaign({
            name,
            title,
            body,
            url: url || '/zapao-da-sorte',
            affiliateCode,
            segment: segment || 'all',
            scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
            createdBy: req.session?.adminName || 'Admin'
        });

        res.json({ success: true, campaign });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/marketing/campaign/:id/send
 * Send a campaign immediately
 */
router.post('/campaign/:id/send', requireAdmin, async (req, res) => {
    try {
        const campaignId = parseInt(req.params.id);
        const result = await RemarketingService.sendCampaign(campaignId);
        res.json({ success: true, ...result });
    } catch (e) {
        console.error('[Marketing] Send campaign error:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/marketing/broadcast
 * Quick broadcast to all subscribers
 */
router.post('/broadcast', requireAdmin, async (req, res) => {
    try {
        const { title, body, url, affiliateCode } = req.body;

        if (!title || !body) {
            return res.status(400).json({ error: 'Título e mensagem são obrigatórios' });
        }

        // Create campaign
        const campaign = await RemarketingService.createCampaign({
            name: `Broadcast ${new Date().toLocaleString('pt-BR')}`,
            title,
            body,
            url: url || '/zapao-da-sorte',
            affiliateCode,
            segment: 'all',
            createdBy: req.session?.adminName || 'Admin'
        });

        // Send immediately
        const result = await RemarketingService.sendCampaign(campaign.id);
        res.json({ success: true, ...result });
    } catch (e) {
        console.error('[Marketing] Broadcast error:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * DELETE /api/marketing/campaign/:id
 * Delete a draft campaign
 */
router.delete('/campaign/:id', requireAdmin, async (req, res) => {
    try {
        const campaignId = parseInt(req.params.id);
        await query('DELETE FROM campaigns WHERE id = $1 AND status = $2', [campaignId, 'draft']);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/marketing/vapid-public-key
 * Get VAPID public key for frontend
 */
router.get('/vapid-public-key', (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
});

module.exports = router;

