const express = require('express');
const router = express.Router();
const OrderService = require('../services/OrderService');
const ScratchCardService = require('../services/ScratchCardService');
const { query } = require('../database/db');

/**
 * POST /api/debug/fake-payment/:orderId
 * Simulate payment approval for testing
 */
router.post('/fake-payment/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        console.log(`[DEBUG_ENTRY] Received fake-payment request for ${orderId}`);

        // Get initial order
        const order = await OrderService.getOrder(orderId);

        // Find ALL orders in this batch (same payment_id or same buyer_ref batch)
        let relatedOrders = [order];

        if (order.payment_id) {
            const allRes = await query(`SELECT * FROM orders WHERE payment_id = $1`, [order.payment_id]);
            if (allRes.rows.length > 0) {
                relatedOrders = allRes.rows;
            }
        } else if (order.buyer_ref && order.buyer_ref.includes('BATCH-')) {
            // Fallback: Group by buyer_ref if it contains a Batch ID (created by bulk route)
            const allRes = await query(`
                SELECT * FROM orders 
                WHERE buyer_ref = $1 
                AND draw_id = $2
                AND status = 'PENDING' 
            `, [order.buyer_ref, order.draw_id]);

            if (allRes.rows.length > 0) {
                relatedOrders = allRes.rows;
            }
        }

        const orderIds = relatedOrders.map(o => o.order_id);
        console.log(`[DEBUG] Found ${orderIds.length} orders in batch`);

        // Calculate total amount
        let totalAmount = relatedOrders.reduce((sum, o) => sum + parseFloat(o.amount), 0);

        // Prepare context for ScratchCardService
        const batchContext = {
            ...order,
            amount: totalAmount,
            batchSize: relatedOrders.length // Critical for correct calculation
        };

        // Generate scratchcards FIRST (while PENDING logic applies)
        let cards = [];
        try {
            // Need to pass batchContext which behaves like the "order" object but enriched
            cards = await ScratchCardService.generateForOrder(batchContext);
            console.log(`[DEBUG] Generated ${cards.length} scratchcards`);
        } catch (genErr) {
            console.error('[DEBUG] Scratchcard generation failed:', genErr);
        }

        // NOW mark ALL as PAID
        // NOW mark ALL as PAID
        if (order.payment_id) {
            await query(`UPDATE orders SET status = 'PAID' WHERE payment_id = $1`, [order.payment_id]);
        } else if (order.buyer_ref && order.buyer_ref.includes('BATCH-')) {
            await query(`UPDATE orders SET status = 'PAID' WHERE buyer_ref = $1 AND draw_id = $2`, [order.buyer_ref, order.draw_id]);
        } else {
            await query(`UPDATE orders SET status = 'PAID' WHERE order_id = $1`, [order.order_id]);
        }

        console.log(`[DEBUG] Marked ${orderIds.length} orders as PAID`);

        res.json({
            success: true,
            orderId,
            cardsGenerated: cards.length,
            cards: cards
        });
    } catch (e) {
        console.error('[DEBUG] Fake payment error:', e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
