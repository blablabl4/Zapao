// COMISSÃO LÍQUIDA - Marcos Luis (11947781150)
const { Client } = require('pg');

async function main() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const phone = '11947781150';

        console.log('═'.repeat(80));
        console.log('💰 COMISSÃO LÍQUIDA - Marcos Luis de Sousa Pereira');
        console.log('📱 Telefone: 11947781150');
        console.log('═'.repeat(80));

        // Buscar vendas onde ele é o referrer (usando base64 do telefone)
        const refPattern = Buffer.from(`${phone}-`).toString('base64').substring(0, 10);

        const vendas = await client.query(`
            SELECT 
                COUNT(*) as total_tickets,
                COUNT(DISTINCT buyer_ref) as clientes_unicos,
                SUM(amount) as receita_total
            FROM orders
            WHERE status = 'PAID'
              AND (referrer_id LIKE $1 OR referrer_id LIKE '%${phone}%')
        `, [`%${refPattern}%`]);

        const v = vendas.rows[0];
        const receitaTotal = parseFloat(v.receita_total || 0);

        // Cálculos de comissão
        const comissaoBruta = receitaTotal * 0.50;      // 50%
        const taxaPagamento = receitaTotal * 0.0099;    // 0.99%
        const comissaoLiquida = receitaTotal * 0.4901;  // 49.01%

        console.log('\n📊 VENDAS DIRETAS:');
        console.log('─'.repeat(80));
        console.log(`   Tickets Vendidos: ${v.total_tickets}`);
        console.log(`   Clientes Únicos: ${v.clientes_unicos}`);
        console.log(`   Receita Total: R$ ${receitaTotal.toFixed(2)}`);

        console.log('\n💵 BREAKDOWN DE COMISSÃO:');
        console.log('─'.repeat(80));
        console.log(`   Comissão Bruta (50%):        R$ ${comissaoBruta.toFixed(2)}`);
        console.log(`   Taxa de Pagamento (0.99%):   R$ ${taxaPagamento.toFixed(2)}`);
        console.log(`   ───────────────────────────────────────────`);
        console.log(`   COMISSÃO LÍQUIDA (49.01%):   R$ ${comissaoLiquida.toFixed(2)}`);

        // Sub-afiliados
        const subs = await client.query(`
            SELECT 
                COUNT(sa.sub_code) as total_subs,
                COUNT(DISTINCT CASE WHEN o.order_id IS NOT NULL THEN sa.sub_code END) as subs_com_vendas,
                COUNT(o.order_id) as tickets_subs,
                SUM(o.amount) as receita_subs
            FROM sub_affiliates sa
            LEFT JOIN orders o ON o.referrer_id = sa.sub_code AND o.status = 'PAID'
            WHERE sa.parent_phone = $1
        `, [phone]);

        const s = subs.rows[0];
        const receitaSubs = parseFloat(s.receita_subs || 0);
        const comissaoSubs = receitaSubs * 0.25;  // 25% para o parent

        if (s.total_subs > 0) {
            console.log('\n👥 SUB-AFILIADOS:');
            console.log('─'.repeat(80));
            console.log(`   Sub-Links Criados: ${s.total_subs}`);
            console.log(`   Sub-Links com Vendas: ${s.subs_com_vendas}`);
            console.log(`   Tickets Vendidos: ${s.tickets_subs}`);
            console.log(`   Receita Gerada: R$ ${receitaSubs.toFixed(2)}`);
            console.log(`   Comissão para Marcos (25%): R$ ${comissaoSubs.toFixed(2)}`);
        }

        // TOTAL GERAL
        const receitaGeral = receitaTotal + receitaSubs;
        const comissaoGeral = comissaoLiquida + comissaoSubs;

        console.log('\n' + '═'.repeat(80));
        console.log('🏆 TOTAIS CONSOLIDADOS:');
        console.log('═'.repeat(80));
        console.log(`   Receita Total Gerada:           R$ ${receitaGeral.toFixed(2)}`);
        console.log(`   Comissão Líquida Vendas Diretas: R$ ${comissaoLiquida.toFixed(2)}`);
        console.log(`   Comissão de Sub-Afiliados:       R$ ${comissaoSubs.toFixed(2)}`);
        console.log('   ─────────────────────────────────────────────────────');
        console.log(`   💰 COMISSÃO TOTAL LÍQUIDA:       R$ ${comissaoGeral.toFixed(2)}`);
        console.log('═'.repeat(80));

        await client.end();
    } catch (e) {
        console.error('❌ Erro:', e.message);
    }
}

main();
