const { query } = require('./src/database/db');

async function check() {
    try {
        const res = await query("SELECT status, count(*) FROM az_tickets WHERE round_number=6 GROUP BY status");
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    }
}
check();
