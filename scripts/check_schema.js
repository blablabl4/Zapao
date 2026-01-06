const { query } = require('../src/database/db');

async function checkSchema() {
    try {
        const r = await query("SELECT * FROM webhook_events LIMIT 1");
        console.log('Columns:', Object.keys(r.rows[0]));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

checkSchema();
