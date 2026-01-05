const { query } = require('./src/database/db');

async function detectiveClean() {
    try {
        console.log('--- DETECTIVE CLEAN: ALL ORDERS #46 ---');

        const res = await query(`
            SELECT o.order_id, o.buyer_ref, o.status, o.created_at, p.paid_at, o.draw_id
            FROM orders o
            LEFT JOIN payments p ON o.order_id = p.order_id
            WHERE o.number = 46
            ORDER BY o.created_at ASC
        `);

        // Output as simple JSON list
        const simple = res.rows.map(r => ({
            name: r.buyer_ref ? r.buyer_ref.split('|')[0] : 'Unknown',
            status: r.status,
            draw: r.draw_id,
            created_utc: r.created_at.toISOString(),
            // Estimating Local (-3)
            local_est: new Date(new Date(r.created_at).getTime() - 3 * 3600 * 1000).toISOString().replace('Z', '')
        }));

        console.log(JSON.stringify(simple, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

detectiveClean();
