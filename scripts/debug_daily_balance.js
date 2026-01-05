const { query, pool } = require('../src/database/db');
require('dotenv').config();

async function debugDaily() {
    try {
        console.log('🔍 Daily Financial Breakdown...');

        // Get all days with activity
        const sql = `
            SELECT 
                date(paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') as day
            FROM payments
            GROUP BY day
            ORDER BY day ASC
        `;
        const daysRes = await query(sql);
        const days = daysRes.rows.map(r => r.day.toISOString().split('T')[0]);
        // Add checks for prize days if different

        let cumulativeNet = 0;
        let cumulativeRev = 0;

        console.log('DATE       | REV     | PRIZES  | NET DAY |  CUMULATIVE NET');

        for (const d of days) {
            // Revenue
            const rSql = `SELECT SUM(amount_paid) as t FROM payments WHERE date(paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = '${d}'`;
            const rRes = await query(rSql);
            const rev = parseFloat(rRes.rows[0].t || 0);

            // Prizes
            const pSql = `SELECT SUM(payout_each * winners_count) as t FROM draws 
                          WHERE (status='CLOSED' OR winners_count>0) 
                          AND date(closed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = '${d}'`;
            const pRes = await query(pSql);
            const prize = parseFloat(pRes.rows[0].t || 0);

            const fee = rev * 0.0099;
            const net = rev - prize - fee;

            cumulativeRev += rev;
            cumulativeNet += net;

            console.log(`${d} | ${rev.toFixed(2).padStart(7)} | ${prize.toFixed(2).padStart(7)} | ${net.toFixed(2).padStart(7)} | ${cumulativeNet.toFixed(2).padStart(15)}`);
        }

        console.log('------------------------------------------------');
        console.log(`TOTAL REV: ${cumulativeRev.toFixed(2)}`);
        console.log(`TOTAL NET: ${cumulativeNet.toFixed(2)}`);

        setTimeout(() => process.exit(0), 1000);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

debugDaily();
