const { query, pool } = require('../src/database/db');
require('dotenv').config();

async function debugSum() {
    try {
        console.log('🔍 Calculating Exact Net Sums...');

        const sql = `
            SELECT 
                d.id, 
                d.draw_name, 
                d.status,
                 COALESCE(SUM(p.amount_paid), 0) as revenue,
                 (d.payout_each * d.winners_count) as prize
            FROM draws d
            LEFT JOIN orders o ON o.draw_id = d.id
            LEFT JOIN payments p ON p.order_id = o.order_id
            WHERE d.status = 'CLOSED'
            GROUP BY d.id
            ORDER BY d.id ASC
        `;

        const res = await query(sql);

        let totalNet = 0;
        console.log('--- CLOSED RAFFLES ---');
        res.rows.forEach(d => {
            const rev = parseFloat(d.revenue);
            const prize = parseFloat(d.prize);
            const fee = rev * 0.0099; // 0.99% fee
            const net = rev - prize - fee;

            totalNet += net;
            console.log(`#${d.id} ${d.draw_name}: Net ${net.toFixed(2)}`);
        });

        console.log('------------------------');
        console.log(`TOTAL NET (CLOSED): ${totalNet.toFixed(2)}`);
        console.log(`Diff from 1331.18: ${(1331.18 - totalNet).toFixed(2)}`);
        console.log(`Diff from 1255.33: ${(totalNet - 1255.33).toFixed(2)}`);

        setTimeout(() => process.exit(0), 1000);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

debugSum();
