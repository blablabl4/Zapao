const { query } = require('../src/database/db');

async function checkSchema() {
    try {
        console.log('--- CHECKING PRODUCTION SCHEMA ---');

        // 1. Orders Columns
        const cols = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'orders'
        `);
        console.log('Orders Table Columns:', cols.rows.map(r => r.column_name).join(', '));

        // 2. Check for Customers/Users tables
        const tables = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('Existing Tables:', tables.rows.map(r => r.table_name).join(', '));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkSchema();
