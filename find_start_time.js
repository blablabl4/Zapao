const { query } = require('./src/database/db');

async function findStart() {
    try {
        const res = await query("SELECT min(claimed_at) as start_time FROM az_claims WHERE round_number=2 AND status='PAID'");
        console.log('First R2 Payment:', res.rows[0].start_time);
    } catch (e) {
        console.error(e);
    }
}

findStart();
