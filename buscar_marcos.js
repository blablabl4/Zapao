// Script Node.js para buscar dados do Marcos Luis via API
// Execute: node buscar_marcos.js

const https = require('https');

async function getAffiliateData() {
    return new Promise((resolve, reject) => {
        https.get('https://www.tvzapao.com.br/api/audit/affiliates', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function main() {
    try {
        console.log('🔍 Buscando dados de Marcos Luis de Sousa Pereira...\n');

        const data = await getAffiliateData();
        const affiliates = data.affiliates || [];

        // Buscar Marcos Luis
        const marcos = affiliates.find(aff =>
            aff.name && (
                aff.name.toLowerCase().includes('marcos luis') ||
                aff.name.toLowerCase().includes('marcos') && aff.name.toLowerCase().includes('sousa')
            )
        );

        if (!marcos) {
            console.log('❌ Marcos Luis não encontrado na lista de afiliados');
            console.log('\n📋 Afiliados disponíveis:');
            affiliates.forEach((aff, idx) => {
                console.log(`${idx + 1}. ${aff.name} - Tel: ${aff.phone}`);
            });
            return;
        }

        console.log('✅ DADOS ENCONTRADOS:\n');
        console.log('═'.repeat(60));
        console.log('📋 INFORMAÇÕES BÁSICAS');
        console.log('═'.repeat(60));
        console.log(`Nome: ${marcos.name}`);
        console.log(`Telefone: ${marcos.phone}`);
        console.log(`Código Afiliado: ${marcos.referrer_code || 'N/A'}`);

        console.log('\n' + '═'.repeat(60));
        console.log('💰 PERFORMANCE DE VENDAS');
        console.log('═'.repeat(60));
        console.log(`Tickets Vendidos: ${marcos.ticket_count || 0}`);
        console.log(`Clientes Únicos: ${marcos.unique_clients || 0}`);
        console.log(`Receita Total: R$ ${(marcos.total_revenue || 0).toFixed(2)}`);
        console.log(`Comissão Líquida (49.01%): R$ ${(marcos.net_commission || 0).toFixed(2)}`);
        console.log(`Acessos ao Link: ${marcos.access_count || 0}`);

        if (marcos.conversion_rate) {
            console.log(`Taxa de Conversão: ${marcos.conversion_rate}%`);
        }

        // Sub-afiliados
        if (marcos.sub_affiliates && marcos.sub_affiliates.length > 0) {
            console.log('\n' + '═'.repeat(60));
            console.log('👥 SUB-AFILIADOS COM VENDAS');
            console.log('═'.repeat(60));
            marcos.sub_affiliates.forEach((sub, idx) => {
                console.log(`\n${idx + 1}. ${sub.name}`);
                console.log(`   Clientes: ${sub.unique_clients}`);
                console.log(`   Comissão do Sub: R$ ${sub.sub_commission.toFixed(2)} (25%)`);
                console.log(`   Comissão de Marcos: R$ ${sub.parent_commission.toFixed(2)} (25%)`);
            });
        }

        if (marcos.all_sub_links && marcos.all_sub_links.length > 0) {
            console.log('\n' + '═'.repeat(60));
            console.log('🔗 TODOS OS SUB-LINKS CRIADOS');
            console.log('═'.repeat(60));
            marcos.all_sub_links.forEach((link, idx) => {
                console.log(`\n${idx + 1}. ${link.sub_name}`);
                console.log(`   Link: ${link.link}`);
                console.log(`   Criado em: ${new Date(link.created_at).toLocaleDateString('pt-BR')}`);
            });
            console.log(`\nTotal de Sub-Links: ${marcos.sub_links_count || marcos.all_sub_links.length}`);
        }

        // Comissões totais
        if (marcos.total_commission) {
            console.log('\n' + '═'.repeat(60));
            console.log('💵 COMISSÕES TOTAIS');
            console.log('═'.repeat(60));
            console.log(`Comissão de Vendas Diretas: R$ ${marcos.net_commission.toFixed(2)}`);
            console.log(`Comissão de Sub-Afiliados: R$ ${marcos.parent_commission_from_subs.toFixed(2)}`);
            console.log(`TOTAL: R$ ${marcos.total_commission.toFixed(2)}`);
        }

        console.log('\n' + '═'.repeat(60));

    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

main();
