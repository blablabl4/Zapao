const { query } = require('../src/database/db');

async function debugStats() {
    console.log('--- DEBUGGING STATS ---');

    // 1. Get Current Draw
    const currentDrawRes = await query(`SELECT * FROM draws ORDER BY id DESC LIMIT 1`);
    // actually getCurrentDraw usually picks the last one or status='ACTIVE'
    // Let's check what logic retrieves 'current'

    // 2. List last 5 draws
    console.log('\n--- Recent Draws ---');
    const draws = await query(`SELECT id, draw_name, status, sales_locked FROM draws ORDER BY id DESC LIMIT 5`);
    console.table(draws.rows);

    // 3. Count Paid Orders per Draw
    console.log('\n--- Paid Orders per Draw ---');
    for (const draw of draws.rows) {
        const count = await query(`SELECT COUNT(*) FROM orders WHERE draw_id = $1 AND status = 'PAID'`, [draw.id]);
        const revenue = await query(`SELECT SUM(amount) FROM orders WHERE draw_id = $1 AND status = 'PAID'`, [draw.id]);
        console.log(`Draw #${draw.id} (${draw.status}): ${count.rows[0].count} orders, R$ ${revenue.rows[0].sum || 0}`);
    }

    // 4. Count ORPHAN Paid Orders (no draw_id)
    const orphans = await query(`SELECT COUNT(*) FROM orders WHERE draw_id IS NULL AND status = 'PAID'`);
    console.log(`\nOrphan Paid Orders (no draw_id): ${orphans.rows[0].count}`);

    // 5. Total Paid Orders in System
    const total = await query(`SELECT COUNT(*) FROM orders WHERE status = 'PAID'`);
    console.log(`Total Paid Orders in System: ${total.rows[0].count}`);

    process.exit(0);
}

debugStats().catch(e => {
    console.error(e);
    process.exit(1);
});
