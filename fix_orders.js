const { query } = require('./src/database/db');

async function fixOrders() {
    try {
        console.log('Starting legacy order fix...');

        const result = await query(`
            WITH PaidOrders AS (
                SELECT DISTINCT buyer_ref, created_at 
                FROM orders 
                WHERE status = 'PAID'
            )
            UPDATE orders o
            SET status = 'PAID'
            FROM PaidOrders p
            WHERE o.buyer_ref = p.buyer_ref 
              AND o.status IN ('PENDING', 'EXPIRED')
              AND o.created_at > p.created_at - interval '5 minutes'
              AND o.created_at < p.created_at + interval '5 minutes'
            RETURNING o.order_id, o.buyer_ref, o.number
        `);

        console.log(`✅ Fixed ${result.rowCount} orders!`);
        console.table(result.rows);
        process.exit(0);
    } catch (e) {
        console.error('❌ Error fixing orders:', e);
        process.exit(1);
    }
}

fixOrders();
