require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function findConflict() {
    try {
        const phone = '11966099687';
        console.log('Searching for phone:', phone);

        // 1. Broad substring search
        const part = '966099';
        console.log('Searching for phone containing:', part);
        const res = await pool.query("SELECT * FROM customers WHERE phone LIKE $1", [`%${part}%`]);
        console.log('--- Matches by Partial Phone ---');
        console.log(res.rows);

        // 2. List recent customers (likely to contain the erroneous one)
        const latest = await pool.query("SELECT * FROM customers ORDER BY created_at DESC LIMIT 20");
        console.log('\n--- Latest 20 Customers ---');
        latest.rows.forEach(u => console.log(`[${u.id}] ${u.name} | ${u.phone} | PIX: ${u.pix_key} | Created: ${u.created_at}`));

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

findConflict();
