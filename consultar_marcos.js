// Consulta direta ao banco via Railway CLI
// Execute: railway run node consultar_marcos.js

const { Client } = require('pg');

async function consultarMarcos() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Conectado ao banco!\n');

        // 1. Buscar Marcos Luis na tabela de afiliados
        console.log('🔍 Buscando Marcos Luis...\n');
        const affiliateQuery = `
            SELECT phone, name, referrer_code, created_at
            FROM affiliates 
            WHERE name ILIKE '%Marcos%' 
              AND (name ILIKE '%Luis%' OR name ILIKE '%Luiz%')
              AND (name ILIKE '%Sousa%' OR name ILIKE '%Pereira%')
        `;

        const affiliateResult = await client.query(affiliateQuery);

        if (affiliateResult.rows.length === 0) {
            console.log('❌ Marcos Luis não encontrado na tabela de afiliados');
            console.log('\n📋 Listando todos os afiliados disponíveis:\n');

            const allAffiliates = await client.query('SELECT name, phone FROM affiliates ORDER BY name LIMIT 20');
            allAffiliates.rows.forEach((aff, idx) => {
                console.log(`${idx + 1}. ${aff.name} - ${aff.phone}`);
            });

            await client.end();
            return;
        }

        const marcos = affiliateResult.rows[0];
        console.log('═'.repeat(70));
        console.log('✅ AFILIADO ENCONTRADO:');
        console.log('═'.repeat(70));
        console.log(`Nome: ${marcos.name}`);
        console.log(`Telefone: ${marcos.phone}`);
        console.log(`Código: ${marcos.referrer_code}`);
        console.log(`Cadastro: ${new Date(marcos.created_at).toLocaleDateString('pt-BR')}`);

        // 2. Calcular vendas diretas
        console.log('\n═'.repeat(70));
        console.log('💰 VENDAS DIRETAS (49.01% de comissão):');
        console.log('═'.repeat(70));

        const vendasDiretas = await client.query(`
            SELECT 
                COUNT(*) as tickets,
                COUNT(DISTINCT buyer_ref) as clientes_unicos,
                COUNT(DISTINCT draw_id) as rifas,
                SUM(amount) as receita_total,
                SUM(amount) * 0.4901 as comissao
            FROM orders
            WHERE status = 'PAID'
              AND referrer_id = $1
        `, [marcos.referrer_code]);

        const vd = vendasDiretas.rows[0];
        console.log(`Tickets Vendidos: ${vd.tickets}`);
        console.log(`Clientes Únicos: ${vd.clientes_unicos}`);
        console.log(`Rifas com Venda: ${vd.rifas}`);
        console.log(`Receita Gerada: R$ ${parseFloat(vd.receita_total || 0).toFixed(2)}`);
        console.log(`Comissão: R$ ${parseFloat(vd.comissao || 0).toFixed(2)}`);

        // 3. Calcular vendas de sub-afiliados
        console.log('\n═'.repeat(70));
        console.log('👥 VENDAS DE SUB-AFILIADOS (25% de comissão para Marcos):');
        console.log('═'.repeat(70));

        const vendasSubs = await client.query(`
            SELECT 
                COUNT(o.order_id) as tickets,
                COUNT(DISTINCT o.buyer_ref) as clientes_unicos,
                SUM(o.amount) as receita_total,
                SUM(o.amount) * 0.25 as comissao_marcos
            FROM sub_affiliates sa
            LEFT JOIN orders o ON o.referrer_id = sa.sub_code AND o.status = 'PAID'
            WHERE sa.parent_phone = $1
        `, [marcos.phone]);

        const vs = vendasSubs.rows[0];
        console.log(`Tickets Vendidos: ${vs.tickets}`);
        console.log(`Clientes Únicos: ${vs.clientes_unicos}`);
        console.log(`Receita Gerada: R$ ${parseFloat(vs.receita_total || 0).toFixed(2)}`);
        console.log(`Comissão de Marcos: R$ ${parseFloat(vs.comissao_marcos || 0).toFixed(2)}`);

        // 4. TOTAL GERAL
        const comissaoTotal = parseFloat(vd.comissao || 0) + parseFloat(vs.comissao_marcos || 0);
        const receitaTotal = parseFloat(vd.receita_total || 0) + parseFloat(vs.receita_total || 0);

        console.log('\n' + '═'.repeat(70));
        console.log('💵 TOTAIS CONSOLIDADOS:');
        console.log('═'.repeat(70));
        console.log(`Receita Total Gerada: R$ ${receitaTotal.toFixed(2)}`);
        console.log(`COMISSÃO TOTAL: R$ ${comissaoTotal.toFixed(2)}`);
        console.log('═'.repeat(70));

        // 5. Detalhamento por rifa (top 5)
        console.log('\n📊 TOP 5 RIFAS COM MAIS VENDAS:\n');

        const topRifas = await client.query(`
            SELECT 
                d.draw_name,
                COUNT(o.order_id) as tickets,
                SUM(o.amount) as receita
            FROM orders o
            JOIN draws d ON o.draw_id = d.id
            WHERE o.status = 'PAID'
              AND o.referrer_id = $1
            GROUP BY d.draw_name
            ORDER BY tickets DESC
            LIMIT 5
        `, [marcos.referrer_code]);

        topRifas.rows.forEach((rifa, idx) => {
            console.log(`${idx + 1}. ${rifa.draw_name}: ${rifa.tickets} tickets - R$ ${parseFloat(rifa.receita).toFixed(2)}`);
        });

        await client.end();
        console.log('\n✅ Consulta finalizada!\n');

    } catch (error) {
        console.error('❌ Erro:', error.message);
        await client.end();
    }
}

consultarMarcos();
