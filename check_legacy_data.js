const { query } = require('./src/database/db');

async function checkLegacy() {
    console.log('--- Checking Legacy Data (Round 1) ---');
    try {
        // 1. Count PAID orders for Round 1
        const countRes = await query("SELECT count(*) FROM orders WHERE draw_id=1 AND status='PAID'");
        console.log(`PAID Orders for Round 1: ${countRes.rows[0].count}`);

        // 2. Fetch sample to see structure
        if (parseInt(countRes.rows[0].count) > 0) {
            const sample = await query("SELECT * FROM orders WHERE draw_id=1 AND status='PAID' LIMIT 3");
            console.log('\nSample Orders:');
            console.log(sample.rows);
        }

    } catch (e) {
        console.error('ERROR:', e.message);
    }
}

checkLegacy();
