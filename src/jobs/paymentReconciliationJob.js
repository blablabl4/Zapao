const { query } = require('../database/db');
const { getPaymentProvider } = require('../services/PaymentProvider');

let intervalId = null;
let lastRun = null;

/**
 * Payment Reconciliation Job
 * Verifies PENDING orders against Mercado Pago to catch missed webhooks
 * Runs every 5 minutes
 */
async function reconcilePayments() {
    lastRun = new Date();
    try {
        const provider = getPaymentProvider();

        if (!provider.client) {
            console.log('[Reconciliation] No payment provider configured, skipping.');
            return;
        }

        // Find PENDING orders older than 5 minutes but younger than 2 hours
        // (older than 2 hours are likely abandoned)
        const pendingOrders = await query(`
            SELECT DISTINCT ON (buyer_ref) 
                order_id, buyer_ref, amount, created_at, draw_id
            FROM orders
            WHERE status = 'PENDING'
            AND created_at >= NOW() - INTERVAL '2 hours'
            AND created_at <= NOW() - INTERVAL '5 minutes'
            ORDER BY buyer_ref, created_at DESC
            LIMIT 20
        `);

        if (pendingOrders.rows.length === 0) {
            // No pending orders to check - this is normal
            return;
        }

        console.log(`[Reconciliation] Checking ${pendingOrders.rows.length} pending order(s)...`);

        let confirmedCount = 0;

        for (const order of pendingOrders.rows) {
            try {
                // Search for payment in MP by external_reference
                const payments = await provider.searchPayments(order.order_id);

                if (payments && payments.length > 0) {
                    const approvedPayment = payments.find(p => p.status === 'approved');

                    if (approvedPayment) {
                        console.log(`[Reconciliation] ✅ Found approved payment for order ${order.order_id.substring(0, 8)}...`);

                        // Update all orders in this batch to PAID
                        const result = await query(`
                            UPDATE orders 
                            SET status = 'PAID'
                            WHERE buyer_ref = $1 
                            AND draw_id = $2
                            AND status = 'PENDING'
                            RETURNING order_id
                        `, [order.buyer_ref, order.draw_id]);

                        console.log(`[Reconciliation] ✅ Marked ${result.rowCount} order(s) as PAID`);
                        confirmedCount += result.rowCount;
                    }
                }
            } catch (err) {
                // Log but don't stop - continue with other orders
                console.error(`[Reconciliation] Error checking order ${order.order_id.substring(0, 8)}: ${err.message}`);
            }
        }

        if (confirmedCount > 0) {
            console.log(`[Reconciliation] ✅ Session complete: ${confirmedCount} order(s) confirmed`);
        }

    } catch (err) {
        console.error('[Reconciliation] ❌ Fatal Error:', err.message);
    }
}

function start() {
    console.log('[Reconciliation] 🔄 Starting payment reconciliation job (every 5 min)...');

    // Run after 1 minute (give server time to start)
    setTimeout(() => {
        reconcilePayments();
        // Then run every 5 minutes
        intervalId = setInterval(reconcilePayments, 5 * 60 * 1000);
    }, 60 * 1000);
}

function stop() {
    if (intervalId) {
        clearInterval(intervalId);
        console.log('[Reconciliation] Job stopped.');
    }
}

module.exports = { start, stop, getLastRun: () => lastRun };
