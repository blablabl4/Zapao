const { query } = require('../src/database/db');

async function run() {
    const phone = '11983426767';
    console.log(`Checking orders for ${phone}...`);
    try {
        const res = await query(`
            SELECT order_id, number, status, created_at, draw_id
            FROM orders 
            WHERE buyer_ref LIKE $1 
            ORDER BY created_at ASC
        `, [`%${phone}%`]);

        console.table(res.rows.map(r => ({
            id: r.order_id.substring(0, 8),
            draw: r.draw_id,
            num: r.number,
            status: r.status,
            created: r.created_at.toISOString()
        })));
    } catch (e) {
        console.error(e);
    }
}
run();
