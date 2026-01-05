const { query, pool } = require('../src/database/db');
require('dotenv').config();

async function debugRaffles() {
    try {
        console.log('🔍 Revenue Per Raffle...');

        const sql = `
            SELECT 
                d.id, 
                d.draw_name, 
                d.status,
                d.payout_each,
                d.winners_count,
                 COALESCE(SUM(p.amount_paid), 0) as revenue
            FROM draws d
            LEFT JOIN orders o ON o.draw_id = d.id
            LEFT JOIN payments p ON p.order_id = o.order_id
            GROUP BY d.id
            ORDER BY d.id ASC
        `;

        const res = await query(sql);

        console.log('ID | NAME | STATUS | REV | PRIZE | NET');
        let totalRev = 0;

        res.rows.forEach(d => {
            const rev = parseFloat(d.revenue);
            const prize = parseFloat(d.payout_each) * d.winners_count;
            const fee = rev * 0.0099;
            const net = rev - prize - fee;

            totalRev += rev;

            console.log(`#${d.id} | ${d.draw_name.padEnd(10)} | ${d.status} | ${rev.toFixed(2)} | ${prize.toFixed(2)} | ${net.toFixed(2)}`);
        });

        console.log('------------------------');
        console.log(`TOTAL REVENUE: ${totalRev.toFixed(2)}`);

        setTimeout(() => process.exit(0), 1000);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

debugRaffles();
