const express = require('express');
const router = express.Router();
const PaymentService = require('../services/PaymentService');
const { getPaymentProvider } = require('../services/PaymentProvider');

/**
 * POST /api/webhooks/pix
 * Receive Pix payment webhooks from Mercado Pago
 */
router.post('/pix', async (req, res) => {
    try {
        console.log('[Webhook] Received Pix webhook');
        console.log('[Webhook] Headers:', req.headers);
        console.log('[Webhook] Query:', req.query);
        console.log('[Webhook] Body:', req.body);

        // Validate webhook signature (Mercado Pago only)
        const provider = getPaymentProvider();
        if (provider.validateWebhookSignature) {
            const isValid = provider.validateWebhookSignature(req);
            if (!isValid) {
                console.error('[Webhook] Invalid signature');
                return res.status(401).json({ error: 'Invalid signature' });
            }
        }

        // Mercado Pago sends notifications with data.id in query params
        const dataId = req.query['data.id'];
        const type = req.query.type || req.body.type;

        if (type === 'payment' && dataId) {
            // Reconcile: fetch payment details from Mercado Pago
            try {
                const paymentData = await provider.getPayment(dataId);

                // Only process if payment is approved
                if (paymentData.status === 'approved') {
                    const webhookPayload = {
                        order_id: paymentData.external_reference,
                        amount_paid: paymentData.transaction_amount,
                        txid: paymentData.id.toString(),
                        e2eid: paymentData.id.toString(),
                        provider: 'MercadoPago'
                    };

                    const result = await PaymentService.processWebhook(webhookPayload);
                    return res.json(result);
                } else {
                    console.log(`[Webhook] Payment ${dataId} not approved yet:`, paymentData.status);
                    return res.json({ success: true, message: 'Payment pending' });
                }

            } catch (error) {
                console.error('[Webhook] Error fetching payment:', error.message);
                return res.status(500).json({ error: error.message });
            }
        }

        // For mock provider or other types
        const result = await PaymentService.processWebhook(req.body);

        if (result.error) {
            return res.status(400).json(result);
        }

        res.json(result);

    } catch (error) {
        console.error('[Webhook] Error processing webhook:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/webhooks/infinitepay
 * Receive InfinitePay payment webhooks
 */
router.post('/infinitepay', async (req, res) => {
    try {
        console.log('[Webhook InfinitePay] Received webhook');
        console.log('[Webhook InfinitePay] Body:', JSON.stringify(req.body, null, 2));

        const {
            invoice_slug,
            amount,
            paid_amount,
            installments,
            capture_method,
            transaction_nsu,
            order_nsu,
            receipt_url,
            items
        } = req.body;

        // Build webhook payload for PaymentService
        const webhookPayload = {
            order_id: order_nsu, // Our order ID
            amount_paid: paid_amount / 100, // Convert cents to BRL
            txid: transaction_nsu,
            e2eid: invoice_slug,
            provider: 'InfinitePay',
            capture_method: capture_method,
            receipt_url: receipt_url
        };

        const result = await PaymentService.processWebhook(webhookPayload);

        if (result.error) {
            console.error('[Webhook InfinitePay] Processing error:', result.message);
            return res.status(400).json(result);
        }

        console.log('[Webhook InfinitePay] Payment processed successfully');
        res.status(200).json({ success: true });

    } catch (error) {
        console.error('[Webhook InfinitePay] Error:', error.message);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
