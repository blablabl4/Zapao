const { query } = require('./src/database/db');

async function check() {
    try {
        const res = await query(`
            SELECT order_id, number, status, buyer_ref, created_at 
            FROM orders 
            WHERE buyer_ref LIKE '%Gisele Roque Galvão%'
            ORDER BY created_at DESC
        `);
        console.table(res.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
