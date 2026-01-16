const { query } = require('../database/db');
const OrderService = require('./OrderService');
const crypto = require('crypto');
const Logger = require('./LoggerService');

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
        // We only block if it was SUCCESSFUL or pending. FAILED ones can be retried via job (not here).
        // Actually, for webhook endpoint, we should block duplicates to avoid spam.
        const existingEvent = await query('SELECT * FROM webhook_events WHERE hash = $1', [hash]);
        if (existingEvent.rows.length > 0) {

            // IF existing is FAILED, maybe we allow retry?
            // But for now, let's stick to strict idempotency for the Endpoint.
            // The RetryJob will handle re-tries by calling processPaymentLogic directly.

            Logger.warn('WEBHOOK_DUPLICATE', `Event already processed`, { hash: hash.substring(0, 8) });
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

        // Delegate to logic
        return this.processPaymentLogic(raw_payload, eventId);
    }

    /**
     * Internal logic to process payment
     * Can be called by processWebhook (realtime) or RetryJob (recovery)
     */
    async processPaymentLogic(raw_payload, eventId) {
        try {
            // DETECT PAYLOAD TYPE
            let order_id, amount_paid, txid, provider, e2eid;

            // CASE A: Raw MercadoPago Webhook (has action/type and data.id)
            if (raw_payload.action || raw_payload.type) {
                const mpPaymentId = raw_payload.data?.id;
                if (!mpPaymentId) {
                    throw new Error('Invalid MP Webhook: missing data.id');
                }

                Logger.info('WEBHOOK_RAW_PROCESSING', `Fetching MP details for ${mpPaymentId}`, { eventId });

                // Fetch real details from Provider (Security Check)
                const { getPaymentProvider } = require('./PaymentProvider'); // Lazy load to avoid cycles
                const paymentProvider = getPaymentProvider();

                // Fetch valid payment info
                const paymentData = await paymentProvider.getPayment(mpPaymentId);

                if (paymentData.status !== 'approved') {
                    Logger.info('WEBHOOK_IGNORED', `Payment ${mpPaymentId} is ${paymentData.status}, not approved`, null);
                    return { success: true, message: 'Ignored: Not approved' };
                }

                // Normalize data
                order_id = paymentData.external_reference;
                amount_paid = paymentData.transaction_amount;
                txid = paymentData.id.toString();
                provider = 'MercadoPago';
            }
            // CASE B: Internal/Clean Payload (already structured)
            else {
                ({ order_id, amount_paid, txid, e2eid, provider } = raw_payload);
            }

            if (!order_id) {
                throw new Error('Missing order_id in payload');
            }

            // Check if order_id contains multiple IDs (bulk purchase)
            const orderIds = order_id.includes(',') ? order_id.split(',') : [order_id];

            Logger.info('WEBHOOK_RECEIVED', `Processing payment for ${orderIds.length} order(s)`, { orderIds, amount_paid, eventId });

            // Process each order
            let validOrderForScratchcard = null; // Capture one valid order context for scratchcard generation

            for (const singleOrderId of orderIds) {
                const trimmedOrderId = singleOrderId.trim();

                // Get order
                const order = await OrderService.getOrder(trimmedOrderId);
                if (!order) {
                    Logger.error('PAYMENT_FAIL_NO_ORDER', `Order not found: ${trimmedOrderId}`, null);
                    continue; // Skip this order, process others
                }

                // Check if order is already paid
                if (order.status === 'PAID') {
                    Logger.info('PAYMENT_SKIP', `Order ${trimmedOrderId} already paid`, null);
                    continue;
                }

                // Verify order is still valid (not expired)
                // NOTE: If paying late, we MIGHT accept it. But for now, let's just log.
                if (order.status === 'EXPIRED') {
                    Logger.warn('PAYMENT_EXPIRED', `Order ${trimmedOrderId} has expired but was paid`, null);
                    // We could revive it here if we wanted.
                    // For now, continue processing to mark as PAID (fixing the expiration)
                }

                // Calculate actual paid amount per order (handle bulk)
                const totalPaid = parseFloat(amount_paid) || 0;
                const amountPerOrder = orderIds.length > 0 ? (totalPaid / orderIds.length) : 0;

                // Create payment record (one per order)
                try {
                    // Update: use eventId instead of hash for reference if possible, 
                    // but we store hash in payments table.
                    // We need hash.
                    const payloadStr = JSON.stringify(raw_payload);
                    const hash = crypto.createHash('sha256').update(payloadStr).digest('hex');

                    await query(`
                        INSERT INTO payments (order_id, provider, txid, e2eid, amount_paid, event_hash)
                        VALUES ($1, $2, $3, $4, $5, $6)
                    `, [
                        trimmedOrderId,
                        provider || 'MercadoPago',
                        txid || null,
                        e2eid || null,
                        amountPerOrder, // Use actual paid amount share
                        hash
                    ]);
                } catch (err) {
                    if (err.message.includes('duplicate key') || err.message.includes('unique constraint')) {
                        Logger.warn('PAYMENT_ALRAEDY_RECORDED', `Payment already recorded for order ${trimmedOrderId}`, null);
                        // Continue to ensure order status is updated
                    } else {
                        throw err;
                    }
                }

                // Capture this order for scratchcard generation (using the last valid one is fine)
                validOrderForScratchcard = await OrderService.getOrder(trimmedOrderId); // Get latest status/customer_id 

            }

            // ⚡ CRITICAL FIX: Generate scratchcards BEFORE marking as PAID
            // This ensures cards exist when frontend polls for PAID status
            if (validOrderForScratchcard) {
                try {
                    const ScratchCardService = require('./ScratchCardService');
                    // Create context with TOTAL amount paid, not just single ticket price
                    // Ensure we use the full webhook amount for the calculation
                    const totalPaidAmount = parseFloat(amount_paid) || 0;

                    const batchContext = {
                        ...validOrderForScratchcard,
                        amount: totalPaidAmount > 0 ? totalPaidAmount : validOrderForScratchcard.amount,
                        batchSize: orderIds.length // Pass number of items in this batch
                    };

                    console.log(`[SCRATCH_DEBUG] Attempting generation:`, {
                        orderId: validOrderForScratchcard.order_id,
                        customerId: validOrderForScratchcard.customer_id,
                        drawId: validOrderForScratchcard.draw_id,
                        amount: batchContext.amount,
                        totalPaidAmount
                    });

                    Logger.info('SCRATCHCARD_ATTEMPT', `Attempting scratchcard generation for batch amount: ${batchContext.amount}`, { orderId: validOrderForScratchcard.id });

                    const cards = await ScratchCardService.generateForOrder(batchContext);

                    console.log(`[SCRATCH_DEBUG] Generation result: ${cards.length} cards created`);

                    if (cards.length > 0) {
                        Logger.info('SCRATCHCARD_GENERATED', `Generated ${cards.length} scratchcards for batch (ref: ${validOrderForScratchcard.id})`, null);
                    } else {
                        console.log(`[SCRATCH_DEBUG] NO CARDS GENERATED - Check min_order_value config and cumulative logic`);
                    }
                } catch (scratchErr) {
                    console.error('[SCRATCH_DEBUG] Generation failed:', scratchErr);
                    Logger.error('SCRATCHCARD_FAIL', `Failed to generate scratchcards for batch: ${scratchErr.message}`, null);
                }
            }

            // NOW mark as PAID (after scratchcards are created)
            if (validOrderForScratchcard) {
                await OrderService.updateBatchStatus(validOrderForScratchcard.buyer_ref, 'PAID');
                Logger.info('PAYMENT_SUCCESS', `Marked batch for ${validOrderForScratchcard.buyer_ref} as PAID`, { amount: validOrderForScratchcard.amount });
            }


            // Mark webhook as processed
            await query('UPDATE webhook_events SET status = $1, processed_at = $2 WHERE id = $3',
                ['PROCESSED', new Date(), eventId]);

            Logger.info('WEBHOOK_COMPLETE', `Payment processed successfully for ${orderIds.length} order(s)`, null);

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

            Logger.error('WEBHOOK_FAIL', `Error processing webhook: ${error.message}`, { stack: error.stack });

            return {
                success: false,
                message: error.message,
                error: true
            };
        }
    }
}

module.exports = new PaymentService();
