const { query, pool } = require('../src/database/db');
require('dotenv').config();

async function fixRifa9() {
    try {
        console.log('🛠️ Move Rifa 9 (Draw #14) to Jan 3rd...');

        // Update closed_at to 23:59:59 on Jan 3rd
        const sql = `
            UPDATE draws 
            SET closed_at = '2026-01-03 23:59:59-03'
            WHERE id = 14
        `;

        await query(sql);
        console.log('✅ Rifa 9 moved to 2026-01-03 23:59:59');

        // Verify new total for Jan 3rd
        const verifySql = `
            SELECT SUM(payout_each * winners_count) as total
            FROM draws
            WHERE date(closed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = '2026-01-03'
        `;
        const res = await query(verifySql);
        console.log(`🆕 NEW SYSTEM TOTAL FOR JAN 3rd: R$ ${res.rows[0].total}`);

        setTimeout(() => process.exit(0), 1000);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

fixRifa9();
