const express = require('express');
const router = express.Router();
const PaymentService = require('../services/PaymentService');
const Logger = require('../services/LoggerService'); // Ensure Logger is used

/**
 * POST /api/webhooks/pix
 * Callback from MercadoPago
 */
router.post('/pix', async (req, res) => {
    try {
        const payload = req.body;
        console.log('[Webhook] Received:', JSON.stringify(payload)); // Keep raw log for debug

        // Handle MP structure (sometimes data comes differently)
        // Usually: { action: 'payment.created', data: { id: '...' } }
        // OR direct notificationUrl payload we configured (if we used simple notification)

        // For this project, we assume we receive transaction info or we need to fetch it?
        // Let's assume MP sends a notification and we verify signature or ID.

        // SIMPLIFIED HANDLING for now based on previous Amigos Logic
        // In Amigos, we processed raw payload directly or fetched payment?

        // Let's look at OrderService/PaymentService again.
        // PaymentService expects { order_id, amount_paid... } which implies we parse it first?
        // MercadoPago standard webhook sends `type` and `data.id`.

        // TODO: Ensure PaymentService handles MP standard webhook or we parse it here.
        // For "Ebook/Digital", we might just get a status update.

        // For now, let's acknowledge 200 OK to keep MP happy.
        res.status(200).send('OK');

        // Async process
        if (payload.action === 'payment.updated' || payload.action === 'payment.created') {
            const paymentId = payload.data.id;
            // We need to fetch the payment details from MP to get the external_reference (order_id)
            const { getPaymentProvider } = require('../services/PaymentProvider');
            const provider = getPaymentProvider();

            if (provider.client) {
                const payment = await provider.getPayment(paymentId);
                if (payment.status === 'approved') {
                    await PaymentService.processWebhook({
                        order_id: payment.external_reference,
                        amount_paid: payment.transaction_amount,
                        provider: 'MercadoPago',
                        txid: payment.id.toString()
                    });
                }
            }
        }

    } catch (error) {
        Logger.error('WEBHOOK_ROUTE_ERROR', error.message, null);
        res.status(500).send('Error');
    }
});

module.exports = router;
