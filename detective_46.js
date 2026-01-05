const { query } = require('./src/database/db');

async function detective46() {
    try {
        console.log('--- DETECTIVE 46: ALL ORDERS ---');

        const res = await query(`
            SELECT o.order_id, o.buyer_ref, o.status, o.created_at, p.paid_at, o.draw_id
            FROM orders o
            LEFT JOIN payments p ON o.order_id = p.order_id
            WHERE o.number = 46
            ORDER BY o.created_at DESC
        `);

        res.rows.forEach(r => {
            const name = r.buyer_ref ? r.buyer_ref.split('|')[0] : 'Unknown';
            console.log(`User: ${name}`);
            console.log(`Status: ${r.status}`);
            console.log(`Draw ID: ${r.draw_id}`);
            console.log(`Created: ${r.created_at} (UTC)`);
            console.log(`Paid At: ${r.paid_at} (UTC)`);
            console.log('-------------------------');
        });

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

detective46();
