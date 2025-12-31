const { query } = require('./src/database/db');

async function inspect() {
    console.log('--- Inspecting az_claims Columns ---');
    try {
        // Select one row to see all keys
        const res = await query("SELECT * FROM az_claims LIMIT 1");
        if (res.rows.length > 0) {
            console.log('Columns found:', Object.keys(res.rows[0]).join(', '));
            console.log('Sample Data:', res.rows[0]);
        } else {
            console.log('Table empty.');
        }
    } catch (e) {
        console.error(e);
    }
}
inspect();
