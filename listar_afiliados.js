// Listar TODOS os afiliados para encontrar Marcos
const https = require('https');

async function listAllAffiliates() {
    return new Promise((resolve, reject) => {
        https.get('https://www.tvzapao.com.br/api/audit/affiliates', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function main() {
    try {
        console.log('📋 Listando TODOS os afiliados...\n');

        const data = await listAllAffiliates();
        const affiliates = data.affiliates || [];

        console.log(`Total de afiliados: ${affiliates.length}\n`);
        console.log('═'.repeat(80));

        affiliates.forEach((aff, idx) => {
            console.log(`\n${idx + 1}. Nome: ${aff.name}`);
            console.log(`   Telefone: ${aff.phone}`);
            console.log(`   Tickets: ${aff.ticket_count || 0} | Clientes: ${aff.unique_clients || 0} | Receita: R$ ${(aff.total_revenue || 0).toFixed(2)}`);

            // Destacar se contém "Marcos"
            if (aff.name && aff.name.toLowerCase().includes('marcos')) {
                console.log('   ⭐ POSSÍVEL MATCH: Contém "Marcos"');
            }
            if (aff.name && aff.name.toLowerCase().includes('luis')) {
                console.log('   ⭐ POSSÍVEL MATCH: Contém "Luis"');
            }
            if (aff.name && aff.name.toLowerCase().includes('sousa')) {
                console.log('   ⭐ POSSÍVEL MATCH: Contém "Sousa"');
            }
        });

        console.log('\n' + '═'.repeat(80));

        // Buscar por variações
        const searchTerms = ['marcos', 'luis', 'sousa', 'pereira'];
        console.log('\n🔍 Buscando por variações do nome...\n');

        const possible = affiliates.filter(aff => {
            const name = (aff.name || '').toLowerCase();
            return searchTerms.some(term => name.includes(term));
        });

        if (possible.length > 0) {
            console.log(`✅ Encontrados ${possible.length} possíveis matches:\n`);
            possible.forEach((aff, idx) => {
                console.log(`${idx + 1}. ${aff.name} - ${aff.phone}`);
            });
        } else {
            console.log('❌ Nenhum afiliado encontrado com esses termos');
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

main();
