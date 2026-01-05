const { query, pool } = require('../src/database/db');
require('dotenv').config();

async function debugManual() {
    try {
        console.log('🔍 Searching for "manual_fix_target"...');

        const sql = `
            SELECT id, paid_at, amount_paid, provider 
            FROM payments 
            WHERE provider = 'manual_fix_target'
        `;

        const res = await query(sql);
        console.table(res.rows);

        // Also checks raw count for Jan 2nd
        const rawSql = `SELECT count(*) FROM payments WHERE date(paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = '2026-01-02'`;
        const rawRes = await query(rawSql);
        console.log(`Raw Count for Jan 2nd: ${rawRes.rows[0].count}`);

        setTimeout(() => process.exit(0), 1000);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

debugManual();
