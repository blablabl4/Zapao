const { query } = require('../src/database/db');
const OrderService = require('../src/services/OrderService'); // Check path
const ScratchCardService = require('../src/services/ScratchCardService'); // Check path

async function run() {
    try {
        console.log('Fetching latest pending order...');
        const res = await query(`SELECT order_id FROM orders WHERE status = 'PENDING' ORDER BY created_at DESC LIMIT 1`);
        if (res.rows.length === 0) {
            console.log('No pending orders found.');
            return;
        }

        const orderId = res.rows[0].order_id;
        console.log('Testing with order:', orderId);

        // --- LOGIC FROM debug.js ---
        const order = await OrderService.getOrder(orderId);
        if (!order) {
            console.log('Order not found via service');
            return;
        }

        console.log('Order data:', order);

        let relatedOrders = [order];

        if (order.payment_id) {
            console.log('Has payment_id');
            const allRes = await query(`SELECT * FROM orders WHERE payment_id = $1`, [order.payment_id]);
            if (allRes.rows.length > 0) {
                relatedOrders = allRes.rows;
            }
        } else if (order.buyer_ref && order.buyer_ref.includes('BATCH-')) {
            console.log('Using fallback buyer_ref logic');
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
        } else {
            console.log('No grouping found');
        }

        console.log(`Found ${relatedOrders.length} related orders`);

        // Calculate total amount
        let totalAmount = relatedOrders.reduce((sum, o) => sum + parseFloat(o.amount), 0);

        // Prepare context for ScratchCardService
        const batchContext = {
            ...order,
            amount: totalAmount,
            batchSize: relatedOrders.length
        };

        console.log('Batch Context:', batchContext);

        // Generate scratchcards 
        let cards = [];
        try {
            cards = await ScratchCardService.generateForOrder(batchContext);
            console.log(`Generated ${cards.length} scratchcards`);
        } catch (genErr) {
            console.error('Scratchcard generation failed:', genErr);
        }

        console.log('Success (No crash)');

    } catch (e) {
        console.error('CRASHED:', e);
    }
}

run();
