const { query, pool } = require('../src/database/db');
require('dotenv').config();

async function updateTime() {
    try {
        console.log('🕒 Moving manual fix payments to 12:00:00...');

        const sql = `UPDATE payments SET paid_at = '2026-01-02 12:00:01-03' WHERE provider = 'manual_fix_target'`;
        const res = await query(sql);

        console.log(`✅ Updated ${res.rowCount} records to Noon.`);

        setTimeout(() => process.exit(0), 1000);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

updateTime();
