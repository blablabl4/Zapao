const { query } = require('./src/database/db');

async function checkTimes() {
    try {
        console.log('--- DB TIME CHECK ---');
        const timeRes = await query('SELECT NOW() as db_time');
        console.log(`DB NOW(): ${timeRes.rows[0].db_time}`);

        console.log('\n--- DRAW 5 INFO ---');
        const drawRes = await query('SELECT * FROM draws WHERE id = 5');
        const draw = drawRes.rows[0];
        console.log(`Draw Start: ${draw.start_time}`);
        console.log(`Draw Created: ${draw.created_at}`);

        console.log('\n--- DISPUTED WINNERS (#46) ---');
        const winners = await query(`
            SELECT buyer_ref, created_at, order_id 
            FROM orders 
            WHERE number = 46 AND draw_id = 5
        `);

        winners.rows.forEach(w => {
            console.log(`Buyer: ${w.buyer_ref.split('|')[0]}`);
            console.log(`Bought At: ${w.created_at}`);
            console.log('---');
        });

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkTimes();
