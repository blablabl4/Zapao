const express = require('express');
const router = express.Router();
const bolaoService = require('../services/BolaoService');

// Get Grid Status
router.get('/grid', async (req, res) => {
    try {
        const data = await bolaoService.getGrid();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Lookup User
router.get('/lookup/:phone', async (req, res) => {
    try {
        const user = await bolaoService.lookupUser(req.params.phone);
        res.json({ found: !!user, ...user });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Checkout
router.post('/checkout', async (req, res) => {
    try {
        const { phone, name, cpf, numbers } = req.body;
        // Basic Validation
        if (!phone || !name || !cpf || !numbers || !Array.isArray(numbers) || numbers.length === 0) {
            throw new Error('Dados incompletos ou inválidos.');
        }

        const result = await bolaoService.checkout(phone, name, cpf, numbers.map(n => parseInt(n)));
        res.json(result);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// Webhook (Mercado Pago)
router.post('/webhook', async (req, res) => {
    try {
        const { action, data, type } = req.body;
        console.log('[Bolao Webhook]', JSON.stringify(req.body));

        // MP sends 'payment.created' or 'payment.updated'
        // We care about 'data.id'
        if (data && data.id) {
            // Process async to avoid timeout
            bolaoService.processWebhook(data.id).catch(err => console.error(err));
        }

        res.sendStatus(200);
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
});

// Manual Payment Confirmation (Admin/Debug)
router.post('/confirm/:paymentId', async (req, res) => {
    try {
        console.log('[Manual Confirm] Payment ID:', req.params.paymentId);
        await bolaoService.processWebhook(req.params.paymentId);
        res.json({ success: true, message: 'Processed' });
    } catch (e) {
        console.error('[Manual Confirm Error]', e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
