const { query } = require('../src/database/db');

async function run() {
    try {
        console.log('Atualizando min_order_value para 1.00...');

        // Ensure table exists (just in case)
        await query(`
            CREATE TABLE IF NOT EXISTS scratch_config (
                key VARCHAR(50) PRIMARY KEY,
                value TEXT
            );
        `);

        const res = await query(`
            INSERT INTO scratch_config (key, value) 
            VALUES ('min_order_value', '1.00') 
            ON CONFLICT (key) DO UPDATE SET value = '1.00'
            RETURNING *
        `);

        console.log('✅ Config atualizada:', res.rows[0]);
        process.exit(0);
    } catch (e) {
        console.error('ERRO:', e);
        process.exit(1);
    }
}

run();
