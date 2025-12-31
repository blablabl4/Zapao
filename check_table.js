const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkTable() {
    try {
        // Check table structure
        const cols = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'az_claims' 
            ORDER BY ordinal_position
        `);

        console.log('📋 Colunas da tabela az_claims:');
        cols.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));

        // Check pending claims
        const pending = await pool.query(`
            SELECT id, payment_id, phone, name, status, total_qty
            FROM az_claims 
            WHERE status = 'PENDING' 
            AND type = 'BOLAO'
            LIMIT 10
        `);

        console.log(`\n🔍 Claims pendentes: ${pending.rows.length}`);
        pending.rows.forEach(r => {
            console.log(`  ID: ${r.id} | Payment: ${r.payment_id} | ${r.name} | Qty: ${r.total_qty}`);
        });

    } catch (e) {
        console.error('❌ Erro:', e.message);
    } finally {
        pool.end();
    }
}

checkTable();
