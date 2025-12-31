const { query } = require('./src/database/db');

async function searchEvents() {
    console.log('--- Searching Event Tables for 30/12 Data ---');
    try {
        // 1. Check az_events schema
        console.log('az_events columns:');
        const evCols = await query("SELECT column_name FROM information_schema.columns WHERE table_name='az_events'");
        console.log(evCols.rows.map(c => c.column_name).join(', '));

        // 2. Check webhook_events schema
        console.log('\nwebhook_events columns:');
        const whCols = await query("SELECT column_name FROM information_schema.columns WHERE table_name='webhook_events'");
        console.log(whCols.rows.map(c => c.column_name).join(', '));

        // 3. Sample from az_events (using actual column name)
        console.log('\n--- Sample az_events ---');
        const evSample = await query("SELECT * FROM az_events ORDER BY id DESC LIMIT 3");
        console.table(evSample.rows);

        // 4. Sample from webhook_events
        console.log('\n--- Sample webhook_events ---');
        const whSample = await query("SELECT * FROM webhook_events ORDER BY id DESC LIMIT 3");
        console.table(whSample.rows);

        // 5. Check az_claims columns for metadata
        console.log('\n--- az_claims columns ---');
        const clCols = await query("SELECT column_name FROM information_schema.columns WHERE table_name='az_claims'");
        console.log(clCols.rows.map(c => c.column_name).join(', '));

    } catch (e) {
        console.error(e);
    }
}
searchEvents();
