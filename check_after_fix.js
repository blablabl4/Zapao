const { query } = require('./src/database/db');

async function checkAfter() {
    try {
        console.log('Checking Gisele status...');
        const res = await query(`
            SELECT order_id, number, status, created_at, amount
            FROM orders 
            WHERE buyer_ref LIKE '%Gisele Roque Galvão%'
            ORDER BY created_at DESC
        `);
        console.table(res.rows);

        console.log('\nChecking Stats...');
        const stats = await query(`
            SELECT count(*) as total_paid, sum(amount) as revenue
            FROM orders
            WHERE status = 'PAID'
        `);
        console.table(stats.rows);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkAfter();
