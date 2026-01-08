const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function sweep() {
    try {
        console.log('🧹 Starting Payment Reconciliation Sweep (Since 09:00 AM Today)...\n');

        // 1. Get Webhooks from today > 9AM
        // We look for payload that contains 'status":"approved"'
        // And we try to extract the ID
        const webhooksRes = await pool.query(`
            SELECT id, received_at, raw_payload 
            FROM webhook_events 
            WHERE received_at >= CURRENT_DATE + TIME '09:00:00'
            ORDER BY received_at DESC
        `);

        console.log(`Found ${webhooksRes.rowCount} webhooks received since 9 AM.`);

        const potentialOrphans = [];

        for (const row of webhooksRes.rows) {
            const payload = JSON.parse(row.raw_payload);

            // Check if it's an approved payment
            // Mod: MP payload usually has action: 'payment.created' or 'payment.updated'
            // and checking api for status.
            // OR payload has data.id.

            // Note: The system usually fetches status from MP API.
            // But here we just want to see if we have webhooks for orders that are BAD.

            // If payload has 'external_reference', that's the Order ID.
            // If not, we might need to fetch plain orders.

            let orderId = null;
            let status = null;

            // Try to parse typical MP Webhook payload structure (simplified)
            // Ideally we should look at 'type' or 'action'.
            // But let's assume we can't fetch from MP API now, just looking for clues.

            // Actually, the `payments` table has `txid` (MP ID). 
            // Let's check `payments` table for today vs `orders` table.

            // ALTERNATIVE STRATEGY:
            // Find Orders created today that are PENDING/EXPIRED.
            // Find Payments created today.
            // If Payment exists for an Order, Order MUST be PAID.
        }

        // BETTER STRATEGY:
        // 1. List all Orders created today (Pending/Expired).
        // 2. List all Payments created today.
        // 3. List Webhooks (just count).

        console.log('\n--- Checking for Inconsistencies ---\n');

        const badOrdersRes = await pool.query(`
            SELECT o.order_id, o.number, o.amount, o.status, o.created_at, o.buyer_ref, p.id as payment_id
            FROM orders o
            LEFT JOIN payments p ON o.order_id = p.order_id
            WHERE o.created_at >= CURRENT_DATE + TIME '09:00:00'
            AND (o.status = 'PENDING' OR o.status = 'EXPIRED')
            AND p.id IS NOT NULL
        `);

        if (badOrdersRes.rowCount > 0) {
            console.log('🚨 CRITICAL: Found ORDERS that have PAYMENTS recorded but are marked PENDING/EXPIRED:');
            console.table(badOrdersRes.rows);
        } else {
            console.log('✅ No internal inconsistencies found (Order vs Payment table).');
        }

        console.log('\n--- Searching Webhooks for potential missed processing ---\n');
        // This is harder without fetching from MP.
        // But we can check if we have webhooks for order_ids that are still pending.

        // List ALL orders today to sanity check DB
        const allOrdersRes = await pool.query(`
            SELECT order_id, number, buyer_ref, status, amount, created_at 
            FROM orders 
            WHERE created_at >= CURRENT_DATE
            ORDER BY created_at DESC
            LIMIT 20
        `);
        console.log('\nLast 20 Orders today (ALL STATUS):');
        console.table(allOrdersRes.rows);

        console.log('\n--- Inspecting Last 5 Webhooks Payloads ---');
        const lastWebhooks = await pool.query(`
            SELECT id, received_at, raw_payload, status
            FROM webhook_events
            ORDER BY received_at DESC
            LIMIT 5
        `);

        for (const row of lastWebhooks.rows) {
            console.log(`\nWebhook ${row.id} at ${row.received_at}:`);
            console.log(row.raw_payload.substring(0, 500)); // First 500 chars
        }

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

sweep();
