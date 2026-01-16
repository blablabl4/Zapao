const { query } = require('../src/database/db');

async function run() {
    try {
        const phone = '11983426767';
        const cep = '04294050'; // User's CEP from screenshot

        console.log('[SCHEMA] Criando coluna zip_code se não existir...');
        try {
            await query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS zip_code VARCHAR(20)`);
            console.log('[SCHEMA] Coluna verificada/criada.');
        } catch (e) {
            console.log('[SCHEMA] Erro ao criar coluna (pode ja existir):', e.message);
        }

        console.log(`[DATA] Atualizando CEP do usuário ${phone} para ${cep}...`);

        const res = await query(`
            UPDATE customers 
            SET zip_code = $1 
            WHERE phone = $2 OR phone = $3
            RETURNING *
        `, [cep, phone, '983426767']);

        if (res.rowCount > 0) {
            console.log('✅ SUCESSO! Usuário atualizado:', res.rows[0].name);
            console.log('Novo CEP no banco:', res.rows[0].zip_code);
        } else {
            console.log('❌ Usuário não encontrado para atualizar.');
        }

        process.exit(0);
    } catch (e) {
        console.error('ERRO FATAL:', e);
        process.exit(1);
    }
}

run();
