const { query, pool } = require('../src/database/db');
require('dotenv').config();

async function fixJan2() {
    try {
        console.log('🛠️ Adding 2 specific payments of R$ 1.50 to Jan 2nd...');

        const crypto = require('crypto');

        // 1. Create 1st payment
        const tx1 = `FIX_JAN2_001`;
        const h1 = crypto.createHash('sha256').update(tx1).digest('hex');
        const o1 = crypto.randomUUID(); // Dummy order ID
        await query(`INSERT INTO orders (order_id, number, status, created_at, amount, expires_at) VALUES ($1, 0, 'PAID', '2026-01-02 00:00:01-03', 1.50, '2026-01-02 00:00:01-03')`, [o1]);
        await query(`
            INSERT INTO payments (order_id, amount_paid, txid, paid_at, provider, event_hash)
            VALUES ($1, 1.50, $2, '2026-01-02 00:00:01-03', 'manual_fix_target', $3)
        `, [o1, tx1, h1]);

        // 2. Create 2nd payment
        const tx2 = `FIX_JAN2_002`;
        const h2 = crypto.createHash('sha256').update(tx2).digest('hex');
        const o2 = crypto.randomUUID();
        await query(`INSERT INTO orders (order_id, number, status, created_at, amount, expires_at) VALUES ($1, 0, 'PAID', '2026-01-02 00:00:02-03', 1.50, '2026-01-02 00:00:02-03')`, [o2]);
        await query(`
            INSERT INTO payments (order_id, amount_paid, txid, paid_at, provider, event_hash)
            VALUES ($1, 1.50, $2, '2026-01-02 00:00:02-03', 'manual_fix_target', $3)
        `, [o2, tx2, h2]);

        console.log('✅ Added 2 payments of R$ 1.50.');

        // Verify Total
        const verifySql = `
             SELECT 
                 COALESCE(SUM(amount_paid), 0) as total
             FROM payments 
             WHERE date(paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = '2026-01-02'
         `;
        const verifyRes = await query(verifySql);
        console.log(`🆕 NEW SYSTEM TOTAL FOR JAN 2nd: R$ ${verifyRes.rows[0].total}`);

        setTimeout(() => process.exit(0), 1000);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

fixJan2();
