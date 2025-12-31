const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function confirmAll() {
    try {
        console.log('🔄 Confirmando todos pendentes...\n');

        const result = await pool.query(`
            UPDATE az_claims 
            SET status = 'PAID'
            WHERE status = 'PENDING' AND type = 'BOLAO'
            RETURNING id, payment_id, name, total_qty
        `);

        console.log(`✅ ${result.rows.length} pagamentos confirmados:\n`);
        result.rows.forEach(r => {
            console.log(`  ✓ ${r.name} - ${r.total_qty} cota(s) - Payment: ${r.payment_id}`);
        });

    } catch (e) {
        console.error('❌ Erro:', e.message);
    } finally {
        pool.end();
    }
}

confirmAll();
