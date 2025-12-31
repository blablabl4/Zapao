const { query } = require('./src/database/db');

async function checkTables() {
    console.log('--- Checking for Event Logging Tables ---');
    try {
        const sql = "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name";
        const res = await query(sql);
        console.log('Tables in database:');
        res.rows.forEach(r => console.log(`- ${r.table_name}`));

        // Check if az_events exists
        const eventsCheck = res.rows.find(r => r.table_name === 'az_events');
        if (eventsCheck) {
            console.log('\n✅ az_events table EXISTS! Checking sample data...');
            const sample = await query("SELECT * FROM az_events ORDER BY created_at DESC LIMIT 5");
            console.table(sample.rows);
        } else {
            console.log('\n❌ az_events table does not exist.');
        }

        // Check az_claims for metadata/additional_info column
        console.log('\nChecking az_claims columns...');
        const cols = await query("SELECT column_name FROM information_schema.columns WHERE table_name='az_claims'");
        console.log('az_claims columns:', cols.rows.map(c => c.column_name).join(', '));

    } catch (e) {
        console.error(e);
    }
}
checkTables();
