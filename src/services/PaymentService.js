const { query } = require('../database/db');
const OrderService = require('./OrderService');
const crypto = require('crypto');

class PaymentService {
    /**
     * Process webhook from payment provider
     * @param {object} raw_payload - Webhook payload
     * @returns {object} Processing result
     */
    async processWebhook(raw_payload) {
        const payloadStr = JSON.stringify(raw_payload);

        // Generate hash for idempotency
        const hash = crypto.createHash('sha256').update(payloadStr).digest('hex');

        // Check if already processed
        const existingEvent = await query('SELECT * FROM webhook_events WHERE hash = $1', [hash]);
        if (existingEvent.rows.length > 0) {
            console.log(`[PaymentService] Webhook event already processed (hash: ${hash.substring(0, 8)}...)`);
            return {
                success: true,
                message: 'Event already processed',
                duplicate: true
            };
        }

        // Log webhook event
        const eventResult = await query(`
            INSERT INTO webhook_events (raw_payload, hash, status)
            VALUES ($1, $2, 'PENDING')
            RETURNING id
        `, [payloadStr, hash]);

        const eventId = eventResult.rows[0].id;

        try {
            // Extract payment data from payload
            const { order_id, amount_paid, txid, e2eid, provider } = raw_payload;

            if (!order_id) {
                throw new Error('Missing order_id in webhook payload');
            }

            // Check if order_id contains multiple IDs (bulk purchase)
            const orderIds = order_id.includes(',') ? order_id.split(',') : [order_id];

            console.log(`[PaymentService] Processing payment for ${orderIds.length} order(s)`);

            // Process each order
            for (const singleOrderId of orderIds) {
                const trimmedOrderId = singleOrderId.trim();

                // Get order
                const order = await OrderService.getOrder(trimmedOrderId);
                if (!order) {
                    console.error(`[PaymentService] Order not found: ${trimmedOrderId}`);
                    continue; // Skip this order, process others
                }

                // Check if order is already paid
                if (order.status === 'PAID') {
                    console.log(`[PaymentService] Order ${trimmedOrderId} already paid, skipping`);
                    continue;
                }

                // Verify order is still valid (not expired)
                if (order.status === 'EXPIRED') {
                    console.warn(`[PaymentService] Order ${trimmedOrderId} has expired`);
                    continue;
                }

                // Create payment record (one per order)
                try {
                    await query(`
                        INSERT INTO payments (order_id, provider, txid, e2eid, amount_paid, event_hash)
                        VALUES ($1, $2, $3, $4, $5, $6)
                    `, [
                        trimmedOrderId,
                        provider || 'MercadoPago',
                        txid || null,
                        e2eid || null,
                        order.amount, // Individual order amount (R$ 1.00)
                        hash
                    ]);
                } catch (err) {
                    if (err.message.includes('duplicate key') || err.message.includes('unique constraint')) {
                        console.log(`[PaymentService] Payment already recorded for order ${trimmedOrderId}`);
                        continue;
                    }
                    throw err;
                }

                // Update order status to PAID
                await OrderService.updateOrderStatus(trimmedOrderId, 'PAID');
                console.log(`[PaymentService] Order ${trimmedOrderId} marked as PAID`);
            }

            // Mark webhook as processed
            await query('UPDATE webhook_events SET status = $1, processed_at = $2 WHERE id = $3',
                ['PROCESSED', new Date(), eventId]);

            console.log(`[PaymentService] Payment processed successfully for ${orderIds.length} order(s)`);

            return {
                success: true,
                message: `Payment processed for ${orderIds.length} order(s)`,
                order_ids: orderIds,
                amount_paid: amount_paid
            };

        } catch (error) {
            // Mark webhook as failed
            await query('UPDATE webhook_events SET status = $1, processed_at = $2 WHERE id = $3',
                ['FAILED', new Date(), eventId]);

            console.error(`[PaymentService] Error processing webhook:`, error.message);

            return {
                success: false,
                message: error.message,
                error: true
            };
        }
    }
}

module.exports = new PaymentService();
