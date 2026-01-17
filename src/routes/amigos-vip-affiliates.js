const express = require('express');
const router = express.Router();
const AmigosVipAffiliateService = require('../services/AmigosVipAffiliateService');

// Check Status
router.get('/check/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        const result = await AmigosVipAffiliateService.checkStatus(phone);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Register
router.post('/register', async (req, res) => {
    try {
        const { phone, name, pix_key, zip_code, parent_phone } = req.body;

        if (!phone || !name || !pix_key || !zip_code) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }

        const result = await AmigosVipAffiliateService.register(phone, name, pix_key, zip_code, parent_phone);
        res.json({ success: true, data: result });
    } catch (e) {
        console.error('Register error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Stats
router.get('/stats/:phone', async (req, res) => {
    try {
        const stats = await AmigosVipAffiliateService.getStats(req.params.phone);
        res.json(stats || { sales_count: 0, total_revenue: 0, tickets_sold: 0, sub_affiliates: 0 });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
