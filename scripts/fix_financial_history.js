const { query, pool } = require('../src/database/db');
// Only load dotenv if DATABASE_URL is missing (Local dev)
if (!process.env.DATABASE_URL) {
    require('dotenv').config();
}

async function fixFinancialHistory() {
    console.log('🔄 Starting Financial History Fix...');

    try {
        // 1. Get all processed webhooks
        const res = await query(`
            SELECT raw_payload 
            FROM webhook_events 
            WHERE status IN ('PROCESSED', 'COMPLETED')
        `);

        console.log(`📂 Found ${res.rows.length} webhooks to analyze.`);

        let updatedCount = 0;

        for (const row of res.rows) {
            let payload;
            try {
                payload = typeof row.raw_payload === 'string'
                    ? JSON.parse(row.raw_payload)
                    : row.raw_payload;
            } catch (e) {
                console.warn('⚠️ JSON Parse Error:', e.message);
                continue;
            }

            const { order_id, amount_paid } = payload;

            if (!order_id || !amount_paid) continue;

            const orderIds = order_id.includes(',') ? order_id.split(',') : [order_id];
            const cleanOrderIds = orderIds.map(id => id.trim());
            const totalPaid = parseFloat(amount_paid);

            if (cleanOrderIds.length === 0 || isNaN(totalPaid)) continue;

            // correct amount per order
            const amountPerOrder = totalPaid / cleanOrderIds.length;

            // Update payments
            // We update ALL payments for these order_ids to the correct amount
            // Since order_id is unique in payments (except for retries, but we assume 1 payment per order)

            for (const id of cleanOrderIds) {
                await query(`
                    UPDATE payments 
                    SET amount_paid = $1 
                    WHERE order_id = $2
                `, [amountPerOrder, id]);
            }
            updatedCount += cleanOrderIds.length;
        }

        console.log(`✅ Success! Updated ${updatedCount} payment records with correct amounts.`);

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await pool.end();
    }
}

fixFinancialHistory();
