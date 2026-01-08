const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        console.log('--- Fetching recent webhooks (Parsed) ---\n');

        const webhooksRes = await pool.query(`
            SELECT raw_payload, received_at
            FROM webhook_events 
            WHERE received_at >= NOW() - INTERVAL '12 hours'
            ORDER BY received_at DESC
            LIMIT 100
        `);

        console.log(`Found ${webhooksRes.rowCount} webhooks.`);

        for (const row of webhooksRes.rows) {
            const payload = JSON.parse(row.raw_payload);
            const orderId = payload.order_id;
            const amount = payload.amount_paid;
            const txid = payload.txid;
            const e2eid = payload.e2eid || 'N/A';
            const receivedAt = row.received_at;

            console.log(`[Webhook] Date: ${receivedAt} | Order: ${orderId} | Amt: ${amount} | TXID: ${txid} | E2E: ${e2eid}`);

            // Optional: Check DB status
            const orderRes = await pool.query('SELECT status, buyer_ref FROM orders WHERE order_id = $1', [orderId]);
            let dbStatus = 'MISSING';
            let buyer = 'N/A';

            if (orderRes.rowCount > 0) {
                dbStatus = orderRes.rows[0].status;
                buyer = orderRes.rows[0].buyer_ref;
            }

            console.log(`[Webhook] Order: ${orderId} | Received: ${receivedAt} | Amt: ${amount} | Buyer: ${buyer} | Status: ${dbStatus}`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

check();
