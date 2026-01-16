require('dotenv').config();
const { query } = require('./src/database/db');

async function linkSubaffiliate() {
    try {
        console.log('🔄 Atualizando vínculo do sub-afiliado...');

        const result = await query(
            'UPDATE sub_affiliates SET sub_phone = $1 WHERE sub_code = $2 RETURNING *',
            ['11991025621', 'rei-dos-brinquedos-olck']
        );

        if (result.rows.length > 0) {
            console.log('✅ SUCESSO! Registro atualizado:');
            console.log(JSON.stringify(result.rows[0], null, 2));
        } else {
            console.log('⚠️ Nenhum registro encontrado com sub_code = "rei-dos-brinquedos-olck"');

            // Verificar se existe
            const check = await query('SELECT * FROM sub_affiliates WHERE sub_code = $1', ['rei-dos-brinquedos-olck']);
            console.log('Registros encontrados:', check.rows.length);
            if (check.rows.length > 0) {
                console.log(JSON.stringify(check.rows, null, 2));
            }
        }
    } catch (error) {
        console.error('❌ ERRO:', error.message);
    } finally {
        process.exit();
    }
}

linkSubaffiliate();
