// Query simples - Ver estrutura da tabela affiliates
const { Client } = require('pg');

async function main() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Conectado!\n');

        // Ver colunas da tabela
        const cols = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'affiliates'
        `);

        console.log('📋 Colunas da tabela affiliates:');
        cols.rows.forEach(c => console.log(`- ${c.column_name} (${c.data_type})`));

        // Buscar Marcos por nome
        console.log('\n🔍 Buscando Marcos Luis...\n');
        const result = await client.query(`
            SELECT * FROM affiliates 
            WHERE name ILIKE '%Marcos%' 
            LIMIT 5
        `);

        if (result.rows.length === 0) {
            console.log('Não encontrado. Listando alguns afiliados:\n');
            const all = await client.query('SELECT name, phone FROM affiliates LIMIT 10');
            all.rows.forEach((a, i) => console.log(`${i + 1}. ${a.name} - ${a.phone}`));
        } else {
            console.log('Encontrados:');
            result.rows.forEach(r => console.log(JSON.stringify(r, null, 2)));
        }

        await client.end();
    } catch (e) {
        console.error('Erro:', e.message);
    }
}

main();
