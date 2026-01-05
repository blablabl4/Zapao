const { query, pool } = require('../src/database/db');
require('dotenv').config();

async function revert() {
    try {
        console.log('↩️ Reverting "manual_fix" payments...');

        const sql = `DELETE FROM payments WHERE provider = 'manual_fix' RETURNING id`;
        const res = await query(sql);

        console.log(`✅ Deleted ${res.rowCount} records.`);

        // Verify total for Jan 2nd
        const verifySql = `
             SELECT 
                 COALESCE(SUM(amount_paid), 0) as total
             FROM payments 
             WHERE date(paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = '2026-01-02'
         `;
        const verifyRes = await query(verifySql);
        console.log(`📉 REVERTED SYSTEM TOTAL FOR JAN 2nd: R$ ${verifyRes.rows[0].total} (Expected: 468.00)`);

        setTimeout(() => process.exit(0), 1000);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

revert();
