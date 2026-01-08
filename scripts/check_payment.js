const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        console.log('Checking number 29...');
        const ticketRes = await pool.query('SELECT * FROM orders WHERE number = 29 ORDER BY created_at DESC LIMIT 5');
        console.table(ticketRes.rows);

        console.log('Checking orders for phone 98311-1087...');
        const orderRes = await pool.query("SELECT * FROM orders WHERE buyer_ref LIKE '%983111087%' OR buyer_ref LIKE '%98311-1087%' ORDER BY created_at DESC LIMIT 10");
        console.table(orderRes.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

check();
