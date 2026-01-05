const { query } = require('./src/database/db');

async function checkWinners() {
    try {
        const res = await query(`
            SELECT o.buyer_ref, d.draw_name, d.closed_at, o.number
            FROM orders o
            JOIN draws d ON o.draw_id = d.id
            WHERE o.status = 'PAID' 
              AND o.number = d.drawn_number
              AND d.status = 'CLOSED'
            ORDER BY d.closed_at DESC
        `);
        console.log(JSON.stringify(res.rows, null, 2));

        console.log('\nChecking for Michelle...');
        const michelle = await query(`SELECT * FROM orders WHERE buyer_ref ILIKE '%Michelle%'`);
        console.log(JSON.stringify(michelle.rows, null, 2));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkWinners();
