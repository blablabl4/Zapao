const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('Connecting to DB...');
        // First check current
        const check = await pool.query("SELECT current_round FROM az_campaigns WHERE id = 21");
        console.log('Current Round:', check.rows[0]?.current_round);

        // Update to 4
        const res = await pool.query("UPDATE az_campaigns SET current_round = 4 WHERE id = 21 RETURNING current_round");
        console.log('SUCCESS: Updated to Round:', res.rows[0].current_round);

    } catch (e) {
        console.error('ERROR:', e);
    } finally {
        pool.end();
    }
}

run();
