const express = require('express');
const router = express.Router();
const AmigosVipService = require('../services/AmigosVipService');
const { getRequestInfo } = require('../utils/http');

/**
 * POST /api/amigos-vip/create-order
 * Create a new VIP purchase
 */
router.post('/create-order', async (req, res) => {
    try {
        const { phone, name, qty, device_id } = req.body;

        // Validation
        if (!phone || !name || !qty) {
            return res.status(400).json({ error: 'phone, name, and qty are required' });
        }

        // Phone validation (basic)
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length < 10 || cleanPhone.length > 11) {
            return res.status(400).json({ error: 'Telefone inválido' });
        }

        // Qty validation
        const qtyNum = parseInt(qty);
        if (!Number.isInteger(qtyNum) || qtyNum < 1 || qtyNum > 200) {
            return res.status(400).json({ error: 'Quantidade deve ser entre 1 e 200' });
        }

        // Get request info
        const { ip, userAgent } = getRequestInfo(req);

        // Create purchase
        const result = await AmigosVipService.createPurchase(
            cleanPhone,
            name,
            qtyNum,
            device_id,
            ip,
            userAgent
        );

        res.json(result);
    } catch (error) {
        console.error('[AmigosVIP] Create order error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * GET /api/amigos-vip/purchase-status/:id
 * Check purchase status
 */
router.get('/purchase-status/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const purchase = await AmigosVipService.getPurchase(id);
        if (!purchase) {
            return res.status(404).json({ error: 'Purchase not found' });
        }

        // If paid, get numbers
        let numbers = [];
        if (purchase.status === 'PAID') {
            const result = await AmigosVipService.getPurchasedNumbers(purchase.phone);
            const thisPurchase = result.find(p => p.id === id);
            if (thisPurchase) {
                numbers = thisPurchase.numbers || [];
            }
        }

        res.json({
            status: purchase.status,
            qty: purchase.qty,
            amount: parseFloat(purchase.amount),
            numbers: numbers
        });
    } catch (error) {
        console.error('[AmigosVIP] Purchase status error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/amigos-vip/my-numbers
 * Get purchased numbers for a phone
 */
router.get('/my-numbers', async (req, res) => {
    try {
        const { phone } = req.query;

        if (!phone) {
            return res.status(400).json({ error: 'phone is required' });
        }

        const cleanPhone = phone.replace(/\D/g, '');
        const purchases = await AmigosVipService.getPurchasedNumbers(cleanPhone);

        res.json({
            found: purchases.length > 0,
            purchases: purchases
        });
    } catch (error) {
        console.error('[AmigosVIP] My numbers error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/amigos-vip/settings
 * Public settings for frontend (pricing, etc.)
 */
router.get('/settings', async (req, res) => {
    try {
        const campaign = await AmigosVipService.getActiveCampaign();

        if (!campaign) {
            return res.json({
                active: false,
                message: 'Nenhuma campanha ativa'
            });
        }

        const available = await AmigosVipService.getAvailableCount(campaign.id);

        res.json({
            active: true,
            campaign_name: campaign.name,
            price_per_number: 1.00,
            available_count: available,
            number_range: {
                start: campaign.start_number,
                end: campaign.end_number
            }
        });
    } catch (error) {
        console.error('[AmigosVIP] Settings error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
