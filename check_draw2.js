const { query } = require('./src/database/db');

async function checkDraw2() {
    try {
        console.log('--- DRAW 2 DETAILS ---');
        const draw = await query('SELECT * FROM draws WHERE id = 2');
        console.log(JSON.stringify(draw.rows[0], null, 2));

        if (draw.rows[0]) {
            const drawnNumber = draw.rows[0].drawn_number;
            console.log(`\n--- WINNERS FOR DRAW 2 (Number ${drawnNumber}) ---`);
            const winners = await query(`
                SELECT * FROM orders 
                WHERE draw_id = 2 
                  AND number = $1 
                  AND status = 'PAID'
            `, [drawnNumber]);
            console.log(JSON.stringify(winners.rows, null, 2));

            console.log(`\n--- ALL ORDERS FOR DRAW 2 (Sample) ---`);
            const orders = await query(`
                SELECT created_at, number, buyer_ref 
                FROM orders 
                WHERE draw_id = 2 AND status = 'PAID' 
                ORDER BY created_at ASC LIMIT 5
             `);
            console.log(JSON.stringify(orders.rows, null, 2));
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkDraw2();
