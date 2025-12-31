const { query } = require('./src/database/db');

async function checkSchema() {
    console.log('--- Checking Schema ---');
    try {
        // 1. Columns of az_tickets
        console.log('\n[az_tickets] Columns:');
        const cols = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'az_tickets'");
        console.log(cols.rows.map(r => r.column_name).join(', '));

        // 2. List all tables
        console.log('\n[Tables] Public Schema:');
        const tables = await query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
        console.table(tables.rows.map(r => r.table_name));

    } catch (e) {
        console.error('ERROR:', e.message);
    }
}

checkSchema();
