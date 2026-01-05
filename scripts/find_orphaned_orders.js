const { query, pool } = require('../src/database/db');
require('dotenv').config();

async function findOrphans() {
    try {
        console.log('🔍 Searching for PAID orders without Payments (Jan 2nd - Jan 3rd)...');

        const sql = `
            SELECT o.order_id, o.number, o.status, 
                   o.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' as local_date
            FROM orders o
            LEFT JOIN payments p ON p.order_id = o.order_id
            WHERE o.status = 'PAID'
            AND p.id IS NULL
            AND date(o.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') IN ('2026-01-02', '2026-01-03')
            ORDER BY o.created_at ASC
        `;

        const res = await query(sql);

        if (res.rows.length === 0) {
            console.log('✅ No orphaned orders found for Jan 2nd/3rd.');
        } else {
            console.log('⚠️ ORPHANED ORDERS FOUND (Paid but no Payment record):');
            console.table(res.rows);
            res.rows.forEach(o => {
                console.log(`FOUND ORPHAN: Order ${o.order_id} (Number ${o.number}) at ${o.local_date}`);
            });
        }

        setTimeout(() => process.exit(0), 1000);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

findOrphans();
