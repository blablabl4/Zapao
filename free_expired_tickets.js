const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function freeExpiredTickets() {
    try {
        console.log('🔍 Buscando números expirados para liberar...\n');

        // Free tickets from expired PENDING claims
        const result = await pool.query(`
            UPDATE az_tickets
            SET status = 'AVAILABLE', assigned_claim_id = NULL
            WHERE status = 'ASSIGNED'
            AND assigned_claim_id IN (
                SELECT id FROM az_claims 
                WHERE status = 'PENDING' 
                AND type = 'BOLAO'
                AND expires_at < NOW()
            )
            RETURNING number
        `);

        if (result.rows.length > 0) {
            console.log(`✅ ${result.rows.length} números liberados:`);
            const numbers = result.rows.map(r => r.number).sort((a, b) => a - b);
            console.log(`   ${numbers.join(', ')}`);
        } else {
            console.log('✅ Nenhum número expirado encontrado.');
        }

        // Delete expired pending claims
        const deleted = await pool.query(`
            DELETE FROM az_claims
            WHERE status = 'PENDING' 
            AND type = 'BOLAO'
            AND expires_at < NOW()
            RETURNING id, payment_id
        `);

        if (deleted.rows.length > 0) {
            console.log(`\n🗑️  ${deleted.rows.length} claims expirados removidos.`);
        }

    } catch (e) {
        console.error('❌ Erro:', e.message);
    } finally {
        pool.end();
    }
}

freeExpiredTickets();
