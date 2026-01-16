const { query } = require('../src/database/db');

async function run() {
    try {
        console.log('📝 Atualizando configuração de raspadinha...\n');

        // Garantir que tabela existe
        await query(`
            CREATE TABLE IF NOT EXISTS scratch_config (
                key VARCHAR(50) PRIMARY KEY,
                value TEXT,
                description TEXT
            );
        `);

        // Atualizar para sistema baseado em quantidade
        await query(`
            INSERT INTO scratch_config (key, value, description) 
            VALUES ('min_numbers_per_card', '7', 'Quantidade mínima de números para gerar raspadinha') 
            ON CONFLICT (key) DO UPDATE SET value = '7', description = 'Quantidade mínima de números para gerar raspadinha'
        `);

        console.log('✅ Config atualizada: 7 números = 1 raspadinha\n');
        process.exit(0);
    } catch (e) {
        console.error('❌ ERRO:', e.message);
        process.exit(1);
    }
}

run();
