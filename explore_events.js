const { query } = require('./src/database/db');

async function explore() {
    console.log('--- Exploring Event Tables Schema ---');
    try {
        // 1. Get actual az_events sample
        console.log('az_events sample:');
        const ev = await query("SELECT * FROM az_events LIMIT 2");
        if (ev.rows.length > 0) {
            console.log('Columns:', Object.keys(ev.rows[0]).join(', '));
            console.log('Row 1:', JSON.stringify(ev.rows[0], null, 2));
        }

        // 2. Get webhook_events sample
        console.log('\nwebhook_events sample:');
        const wh = await query("SELECT * FROM webhook_events LIMIT 2");
        if (wh.rows.length > 0) {
            console.log('Columns:', Object.keys(wh.rows[0]).join(', '));
            console.log('Row 1:', JSON.stringify(wh.rows[0], null, 2));
        }

        // 3. Check earliest timestamp in az_events
        console.log('\n--- Earliest az_events ---');
        const earliest = await query("SELECT id, type, timestamp FROM az_events ORDER BY id ASC LIMIT 5");
        console.table(earliest.rows);

        // 4. Count events from 30/12
        console.log('\n--- Event counts by date ---');
        const counts = await query("SELECT DATE(timestamp) as dt, count(*) FROM az_events GROUP BY DATE(timestamp) ORDER BY dt");
        console.table(counts.rows);

    } catch (e) {
        console.error(e);
    }
}
explore();
