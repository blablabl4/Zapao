const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const paymentIds = [
    '140054806722',
    '139406100999',
    '140054102170',
    '140050582254'
];

async function confirmPayments() {
    try {
        console.log('🔍 Buscando claims pendentes...');

        for (const paymentId of paymentIds) {
            console.log(`\n⏳ Processando payment_id: ${paymentId}`);

            const result = await pool.query(`
                UPDATE az_claims 
                SET status = 'PAID', updated_at = NOW()
                WHERE payment_id = $1 AND status = 'PENDING'
                RETURNING id, phone, name, total_qty
            `, [paymentId]);

            if (result.rows.length > 0) {
                const claim = result.rows[0];
                console.log(`✅ CONFIRMADO! Claim ID: ${claim.id} | ${claim.name} (${claim.phone}) | ${claim.total_qty} cotas`);
            } else {
                console.log(`⚠️  Não encontrado ou já confirmado: ${paymentId}`);
            }
        }

        console.log('\n✅ Processo concluído!');

    } catch (e) {
        console.error('❌ Erro:', e.message);
    } finally {
        pool.end();
    }
}

confirmPayments();
