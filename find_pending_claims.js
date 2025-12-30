const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('Buscando claims pendentes...');
        const res = await pool.query(`
            SELECT id, phone, name, payment_id, status, created_at 
            FROM az_claims 
            WHERE status = 'PENDING' 
            ORDER BY created_at DESC 
            LIMIT 5
        `);

        console.log('Claims Pendentes:');
        res.rows.forEach(r => {
            console.log(`  ID: ${r.id} | Phone: ${r.phone} | Name: ${r.name} | PaymentID: ${r.payment_id} | Status: ${r.status}`);
        });

        if (res.rows.length === 0) {
            console.log('Nenhum claim pendente encontrado.');
        }
    } catch (e) {
        console.error('Erro:', e.message);
    } finally {
        pool.end();
    }
}

run();
