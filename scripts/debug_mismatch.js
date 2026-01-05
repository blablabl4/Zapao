const { query, pool } = require('../src/database/db');
require('dotenv').config();

async function debugMismatch() {
    try {
        console.log('🔍 Checking for Winner Count Mismatches (Jan 3rd - Jan 4th)...');

        // Check if orders has 'id' or 'order_id'
        // But COUNT(*) is safest.

        const sql = `
            SELECT 
                d.id, 
                d.draw_name, 
                d.status,
                d.payout_each,
                d.winners_count as db_count,
                COUNT(o.order_id) as actual_count,
                d.closed_at
            FROM draws d
            LEFT JOIN orders o ON o.draw_id = d.id AND o.number = d.drawn_number AND o.status = 'PAID'
            WHERE date(d.closed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') IN ('2026-01-03', '2026-01-04')
            GROUP BY d.id
            HAVING d.winners_count != COUNT(o.order_id)
            ORDER BY d.id ASC
        `;

        const res = await query(sql);

        if (res.rows.length === 0) {
            console.log('✅ No mismatches found. Database counts match actual winning orders.');

            // Debug: List all Jan 3rd draws anyway to show user
            const listRes = await query(`
                SELECT id, draw_name, winners_count, payout_each 
                FROM draws 
                WHERE date(closed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = '2026-01-03'
            `);
            console.table(listRes.rows);

        } else {
            console.log('⚠️ MISMATCHES FOUND:');
            console.table(res.rows);
            console.log('Fixing mismatches...');

            for (const row of res.rows) {
                console.log(`Fixing Draw #${row.id}: setting winners_count from ${row.db_count} to ${row.actual_count}`);
                await query('UPDATE draws SET winners_count = $1 WHERE id = $2', [row.actual_count, row.id]);
            }
            console.log('✅ Corrections applied.');
        }

        setTimeout(() => process.exit(0), 1000);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

debugMismatch();
