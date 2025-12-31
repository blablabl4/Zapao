const { query } = require('./src/database/db');

async function check() {
    console.log('--- Round 7 Claims ---');
    try {
        const res = await query("SELECT id, type, status, name, total_qty FROM az_claims WHERE round_number=7");
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    }
}
check();
