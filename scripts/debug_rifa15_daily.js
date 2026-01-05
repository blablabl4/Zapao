const { query, pool } = require('../src/database/db');
require('dotenv').config();

async function debugRifa15() {
    try {
        console.log('🔍 Breakdown of Rifa 15 (Active) Sales...');

        const sql = `
            SELECT 
                date(p.paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') as day,
                SUM(p.amount_paid) as revenue
            FROM payments p
            JOIN orders o ON p.order_id = o.order_id
            JOIN draws d ON o.draw_id = d.id
            WHERE d.id = 20
            GROUP BY day
            ORDER BY day ASC
        `;

        const res = await query(sql);
        console.table(res.rows);

        let cum = 0;
        res.rows.forEach(r => {
            const rev = parseFloat(r.revenue);
            const net = rev * (1 - 0.0099);
            cum += net;
            console.log(`Day ${r.day.toISOString().split('T')[0]}: Rev ${rev} | Net ${net.toFixed(2)} | Cumulative Net: ${cum.toFixed(2)}`);
        });

        setTimeout(() => process.exit(0), 1000);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

debugRifa15();
