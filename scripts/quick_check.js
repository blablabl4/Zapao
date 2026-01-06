const { query } = require('../src/database/db');

(async () => {
    const r = await query(`
        SELECT COUNT(*) as total 
        FROM orders 
        WHERE status = 'PAID' 
        AND draw_id = 21 
        AND buyer_ref LIKE '%11994956692%'
    `);
    console.log('PAID para Roberto na Rifa 16:', r.rows[0].total);
    process.exit();
})();
