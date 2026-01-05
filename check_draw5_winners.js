const { query } = require('./src/database/db');

async function checkDraw5Winners() {
    try {
        console.log('--- DRAW 5 STATUS ---');
        const draw = await query('SELECT * FROM draws WHERE id = 5');
        console.log(JSON.stringify(draw.rows[0], null, 2));

        if (draw.rows[0] && draw.rows[0].drawn_number) {
            const num = draw.rows[0].drawn_number;
            console.log(`\n--- WINNERS FOR DRAW 5 (Number ${num}) ---`);
            // This query mimics the Fixed logic: must match draw_id = 5
            const winners = await query(`
                SELECT o.buyer_ref, o.created_at, o.draw_id
                FROM orders o
                WHERE o.draw_id = 5 
                  AND o.number = $1
                  AND o.status = 'PAID'
            `, [num]);

            winners.rows.forEach(w => {
                const parts = w.buyer_ref.split('|');
                console.log(`Winner: ${parts[0] || 'Unknown'} | Pix: ${parts[2] || '-'} | Date: ${w.created_at}`);
            });
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkDraw5Winners();
