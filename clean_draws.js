const { query } = require('./src/database/db');

async function cleanDraws() {
    try {
        console.log('Cleaning up draws 1, 2, 4, 6... (Cascade Delete)');

        // 1. Delete payments for orders in these draws
        await query(`
            DELETE FROM payments 
            WHERE order_id IN (
                SELECT order_id FROM orders WHERE draw_id IN (1, 2, 4, 6)
            )
        `);
        console.log('Payments deleted.');

        // 2. Delete orders
        await query('DELETE FROM orders WHERE draw_id IN (1, 2, 4, 6)');
        console.log('Orders deleted.');

        // 3. Delete draws
        await query('DELETE FROM draws WHERE id IN (1, 2, 4, 6)');
        console.log('Draws deleted.');

        const res = await query('SELECT id, draw_name, status FROM draws ORDER BY id ASC');
        console.log('Remaining draws:');
        console.table(res.rows);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

cleanDraws();
