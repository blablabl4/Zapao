/**
 * Script para importar telefones dos CSVs e atualizar o banco de dados
 * - Limpa dados de grupos anteriores
 * - Atualiza leads com assigned_group_id e carimbo_link
 */

const fs = require('fs');
const path = require('path');

// Configuração
const CSV_GRUPO1 = 'C:\\Users\\Isaque\\Downloads\\Grupo 1.csv';
const CSV_GRUPO2 = 'C:\\Users\\Isaque\\Downloads\\Grupo 2.csv';

const GRUPO1_ID = 1;
const GRUPO2_ID = 2;
const GRUPO1_LINK = 'https://chat.whatsapp.com/JueIIL7xuamLBCnv4W0CEt';
const GRUPO2_LINK = 'https://chat.whatsapp.com/DFGDvDfg6gRLljuKiA4EJH';

// Função para extrair números de telefone do CSV
function extractPhones(csvPath) {
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n').slice(1); // Pula header
    const phones = [];

    for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.split(',');
        if (parts.length >= 3) {
            const phone = parts[2].replace(/[^0-9]/g, ''); // phone_number column
            if (phone.length >= 9) {
                phones.push(phone);
            }
        }
    }
    return phones;
}

// Função para normalizar (últimos 9 dígitos)
function normalize(phone) {
    return phone.slice(-9);
}

// Extrair telefones
console.log('Lendo CSVs...');
const phonesGrupo1 = extractPhones(CSV_GRUPO1).map(normalize);
const phonesGrupo2 = extractPhones(CSV_GRUPO2).map(normalize);

console.log(`Grupo 1: ${phonesGrupo1.length} telefones`);
console.log(`Grupo 2: ${phonesGrupo2.length} telefones`);

// Conectar ao banco
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
    console.error('DATABASE_URL não encontrada!');
    process.exit(1);
}

const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('railway') ? { rejectUnauthorized: false } : false
});

async function run() {
    const client = await pool.connect();

    try {
        console.log('\n=== INICIANDO IMPORTAÇÃO ===\n');

        // 1. Limpar assigned_group_id de todos os leads (reset)
        console.log('1. Resetando todos os leads...');
        const resetResult = await client.query(`
            UPDATE leads 
            SET assigned_group_id = NULL, 
                status = 'LEFT',
                updated_at = NOW()
        `);
        console.log(`   → ${resetResult.rowCount} leads resetados`);

        // 2. Atualizar leads do Grupo 1
        console.log('\n2. Atualizando leads do Grupo 1...');
        const update1 = await client.query(`
            UPDATE leads 
            SET assigned_group_id = $1, 
                status = 'ACTIVE',
                updated_at = NOW()
            WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 9) = ANY($2::text[])
            RETURNING id, phone
        `, [GRUPO1_ID, phonesGrupo1]);
        console.log(`   → ${update1.rowCount} leads atualizados para Grupo 1`);

        // 3. Atualizar leads do Grupo 2
        console.log('\n3. Atualizando leads do Grupo 2...');
        const update2 = await client.query(`
            UPDATE leads 
            SET assigned_group_id = $1, 
                status = 'ACTIVE',
                updated_at = NOW()
            WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 9) = ANY($2::text[])
            RETURNING id, phone
        `, [GRUPO2_ID, phonesGrupo2]);
        console.log(`   → ${update2.rowCount} leads atualizados para Grupo 2`);

        // 4. Atualizar contagem dos grupos
        console.log('\n4. Atualizando contagem dos grupos...');
        await client.query('UPDATE whatsapp_groups SET current_count = $1 WHERE id = $2', [phonesGrupo1.length, GRUPO1_ID]);
        await client.query('UPDATE whatsapp_groups SET current_count = $1 WHERE id = $2', [phonesGrupo2.length, GRUPO2_ID]);
        console.log('   → Contagens atualizadas');

        // 5. Verificar links dos grupos
        console.log('\n5. Atualizando links dos grupos...');
        await client.query('UPDATE whatsapp_groups SET invite_link = $1 WHERE id = $2', [GRUPO1_LINK, GRUPO1_ID]);
        await client.query('UPDATE whatsapp_groups SET invite_link = $1 WHERE id = $2', [GRUPO2_LINK, GRUPO2_ID]);
        console.log('   → Links atualizados');

        // 6. Resumo final
        console.log('\n=== RESUMO FINAL ===');
        const stats = await client.query(`
            SELECT 
                COUNT(*) FILTER (WHERE assigned_group_id = 1) as grupo1,
                COUNT(*) FILTER (WHERE assigned_group_id = 2) as grupo2,
                COUNT(*) FILTER (WHERE assigned_group_id IS NULL) as sem_grupo,
                COUNT(*) as total
            FROM leads
        `);
        console.log(`Grupo 1: ${stats.rows[0].grupo1} leads`);
        console.log(`Grupo 2: ${stats.rows[0].grupo2} leads`);
        console.log(`Sem grupo: ${stats.rows[0].sem_grupo} leads`);
        console.log(`Total: ${stats.rows[0].total} leads`);

        console.log('\n✅ IMPORTAÇÃO CONCLUÍDA!');

    } catch (error) {
        console.error('Erro:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
