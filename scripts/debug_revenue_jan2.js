const { query, pool } = require('../src/database/db');
require('dotenv').config();

async function debugRevenue() {
    try {
        console.log('🔍 Analyzing Revenue for Jan 2nd 2026...');

        const sql = `
            SELECT 
                p.id,
                p.txid,
                p.amount_paid,
                p.paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' as paid_local,
                o.buyer_ref
            FROM payments p
            JOIN orders o ON p.order_id = o.order_id
            WHERE date(p.paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = '2026-01-02'
            ORDER BY p.paid_at ASC
        `;

        const res = await query(sql);
        let total = 0;

        console.log('ID | TXID | AMOUNT | TIME | BUYER');
        res.rows.forEach(p => {
            const val = parseFloat(p.amount_paid);
            total += val;
            // Shorten txid for display
            const txShort = (p.txid || '').substring(0, 10);
            const time = p.paid_local.toISOString().split('T')[1].split('.')[0];
            const name = (p.buyer_ref || '').split('|')[0].substring(0, 15);
            console.log(`#${p.id} | ${txShort}... | R$ ${val.toFixed(2)} | ${time} | ${name}`);
        });

        console.log('------------------------');
        console.log(`SYSTEM TOTAL FOR JAN 2nd: R$ ${total.toFixed(2)}`);

        setTimeout(() => process.exit(0), 1000);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

debugRevenue();
