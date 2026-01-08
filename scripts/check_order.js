const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const orderId = '0a2b7bf2-05c0-425b-934d-f2b0f13e5cf3';
        console.log(`Checking Order: ${orderId}`);

        const res = await pool.query('SELECT number, status, buyer_ref, created_at FROM orders WHERE order_id = $1', [orderId]);
        console.log(JSON.stringify(res.rows, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

check();
