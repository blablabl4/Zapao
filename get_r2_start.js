const { query } = require('./src/database/db');

async function val() {
    try {
        const res = await query("SELECT min(claimed_at) as start_r2 FROM az_claims WHERE round_number=2 AND status='PAID'");
        console.log('R2_START:', res.rows[0].start_r2);
    } catch (e) {
        console.error(e);
    }
}
val();
