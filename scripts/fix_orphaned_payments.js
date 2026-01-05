const { query, pool } = require('../src/database/db');
require('dotenv').config();

async function fixOrphans() {
    try {
        console.log('🛠️ Starting Repair: Finding PAID orders without Payments...');

        // 1. Find Orphans
        const findSql = `
            SELECT o.order_id, o.number, o.created_at, o.buyer_ref
            FROM orders o
            LEFT JOIN payments p ON p.order_id = o.order_id
            WHERE o.status = 'PAID'
            AND p.id IS NULL
            ORDER BY o.created_at ASC
        `;

        const res = await query(findSql);

        if (res.rows.length === 0) {
            console.log('✅ No orphaned orders found. System is clean.');
            setTimeout(() => process.exit(0), 1000);
            return;
        }

        console.log(`⚠️ Found ${res.rows.length} orphaned orders. Fixing now...`);

        // 2. Fix Orphans
        let fixedCount = 0;
        for (const order of res.rows) {
            const amount = 1.50; // Standard price
            const txid = `FIX_ORPHAN_${order.order_id.substring(0, 8)}`;

            // Use created_at as paid_at (since it's an immediate sale usually)
            const paidAt = order.created_at;

            console.log(`   > Fixing Order ${order.number} (${order.order_id})...`);

            const crypto = require('crypto');
            const eventHash = crypto.createHash('sha256').update(txid).digest('hex');

            await query(`
                INSERT INTO payments (order_id, amount_paid, txid, paid_at, provider, event_hash)
                VALUES ($1, $2, $3, $4, 'manual_fix', $5)
            `, [order.order_id, amount, txid, paidAt, eventHash]);

            fixedCount++;
        }

        console.log(`✅ Successfully created ${fixedCount} payment records.`);
        console.log('🔄 Please check the dashboard revenue now.');

        setTimeout(() => process.exit(0), 1000);
    } catch (e) {
        console.error('❌ Error during repair:', e);
        process.exit(1);
    }
}

fixOrphans();
