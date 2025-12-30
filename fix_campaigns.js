const { getPool } = require('./src/database/db');

async function run() {
    const pool = getPool();
    try {
        console.log('--- FIX: Desativar Campanhas Repetidas ---');

        // We know ID 6 is the "correct" one being used (5 tickets). ID 5 is the zombie (0 tickets).
        // Let's set ID active = true and ALL OTHERS active = false.
        const TARGET_ACTIVE_ID = 6;

        console.log(`Definindo ID ${TARGET_ACTIVE_ID} como ÚNICA ativa...`);

        await pool.query('UPDATE az_campaigns SET is_active = true WHERE id = $1', [TARGET_ACTIVE_ID]);
        await pool.query('UPDATE az_campaigns SET is_active = false WHERE id != $1', [TARGET_ACTIVE_ID]);

        console.log('✅ Correção Aplicada.');

    } catch (e) {
        console.error('Erro:', e.message);
    } finally {
        process.exit(0);
    }
}

run();
