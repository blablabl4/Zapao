const { query } = require('./src/database/db');

async function huntWinners() {
    try {
        console.log('Searching for orders #46 between 22:00 and 23:30 (Local) -> 01:00 and 02:30 (UTC)...');

        // UTC Window: 2026-01-03 01:00:00 to 2026-01-03 02:30:00
        const res = await query(`
            SELECT * FROM orders 
            WHERE number = 46 
              AND status = 'PAID'
              AND created_at >= '2026-01-03 01:00:00'
              AND created_at <= '2026-01-03 02:30:00'
        `);

        console.log(`Found ${res.rows.length} orders.`);
        res.rows.forEach(r => {
            console.log(`- Ref: ${r.buyer_ref.split('|')[0]}`);
            console.log(`  Date (UTC): ${r.created_at}`);
            console.log(`  Draw ID: ${r.draw_id}`);
        });

        // Also check nearby orders just in case
        console.log('\n--- Checking ALL #46 ---');
        const all = await query('SELECT created_at, buyer_ref FROM orders WHERE number = 46 AND status = \'PAID\' ORDER BY created_at DESC LIMIT 10');
        all.rows.forEach(r => {
            console.log(`${r.created_at} - ${r.buyer_ref.split('|')[0]}`);
        });

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

huntWinners();
