const { query, pool } = require('../src/database/db');
require('dotenv').config();

async function debugRaw() {
    try {
        console.log('🔍 RAW DUMP of Payments ID 1 to 150...');

        const sql = `
            SELECT 
                id, 
                amount_paid, 
                paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' as paid_local
            FROM payments 
            WHERE id BETWEEN 1 AND 150
            ORDER BY id ASC
        `;

        const res = await query(sql);

        console.log('ID | AMOUNT | PAID_BR');
        let totalJan2 = 0;

        res.rows.forEach(p => {
            const paidStr = p.paid_local ? p.paid_local.toISOString() : 'NULL';
            // Check if it falls on 2026-01-02
            const isJan2 = paidStr.includes('2026-01-02');

            if (isJan2) {
                totalJan2 += parseFloat(p.amount_paid);
            }

            // Only log IDs around boundaries or relevant ones
            if (p.id < 20 || p.id > 100 || isJan2) {
                console.log(`#${p.id} | ${p.amount_paid} | ${isJan2 ? '★ ' : ''}${paidStr}`);
            }
        });

        console.log('------------------------');
        console.log(`CALCULATED TOTAL FOR JAN 2nd (Strict String Match): R$ ${totalJan2.toFixed(2)}`);

        setTimeout(() => process.exit(0), 1000);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

debugRaw();
