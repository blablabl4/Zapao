const { query } = require('./src/database/db');

(async () => {
    try {
        console.log('Checking duplications for Diana...');

        // Find orders
        const res = await query(`
            SELECT order_id, number, status, created_at, buyer_ref 
            FROM orders 
            WHERE buyer_ref LIKE 'DIANA DA SILVA OLIVEIRA%'
            ORDER BY created_at DESC
            LIMIT 20
        `);

        res.rows.forEach(o => {
            console.log(`[${o.status}] #${o.number} - Order: ${o.order_id} - Time: ${o.created_at.toISOString()}`);
        });

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
