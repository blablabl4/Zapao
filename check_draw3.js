const { query } = require('./src/database/db');

async function checkDraw3() {
    try {
        const res = await query(`SELECT * FROM draws WHERE id = 3`);
        const draw = res.rows[0];
        console.log(JSON.stringify(draw, null, 2));

        const winners = await query(`
            SELECT * FROM orders 
            WHERE draw_id = 3 AND number = 47 AND status = 'PAID'
        `);
        console.log(`Winners for 47: ${winners.rowCount}`);
        console.log(JSON.stringify(winners.rows.map(w => w.buyer_ref), null, 2));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkDraw3();
