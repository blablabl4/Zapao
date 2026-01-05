const { query } = require('./src/database/db');

(async () => {
    try {
        console.log('Cleaning PENDING duplications...');

        // Find all PAID numbers for active draws
        const paidQuery = await query(`
            SELECT draw_id, number 
            FROM orders 
            WHERE status = 'PAID'
        `);

        let deletedCount = 0;
        for (const paid of paidQuery.rows) {
            // Find PENDING orders for same draw/number
            const pending = await query(`
                SELECT order_id FROM orders 
                WHERE draw_id = $1 AND number = $2 AND status = 'PENDING'
            `, [paid.draw_id, paid.number]);

            for (const p of pending.rows) {
                console.log(`Deleting duplicates pending #${paid.number} (Order ${p.order_id})`);
                await query('DELETE FROM orders WHERE order_id = $1', [p.order_id]);
                deletedCount++;
            }
        }

        console.log(`Done. Deleted ${deletedCount} duplicate pending orders.`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
