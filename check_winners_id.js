const { query } = require('./src/database/db');

async function checkWinnersDrawId() {
    try {
        console.log('--- WINNERS OF DRAW 5 (Number 46) ---');
        // We know drawn_number is 46. Let's find orders with number 46.
        const res = await query(`
            SELECT order_id, created_at, number, draw_id, buyer_ref 
            FROM orders 
            WHERE number = 46 AND status = 'PAID'
        `);
        console.log(JSON.stringify(res.rows, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkWinnersDrawId();
