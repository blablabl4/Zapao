// CONSULTA FINAL - Marcos Luis (11947781150)
const { Client } = require('pg');

async function main() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const phone = '11947781150';
        const name = 'Marcos Luis de Sousa Pereira';

        console.log('═'.repeat(70));
        console.log(`💰 RELATÓRIO COMPLETO - ${name}`);
        console.log(`📱 Telefone: ${phone}`);
        console.log('═'.repeat(70));

        // Criar código de afiliado baseado no telefone
        const refCode = Buffer.from(`${phone}-default`).toString('base64');

        // Vendas diretas (usando referrer_id)
        const vendasDiretas = await client.query(`
            SELECT 
                COUNT(*) as tickets,
                COUNT(DISTINCT buyer_ref) as clientes,
                COUNT(DISTINCT draw_id) as rifas,
                SUM(amount) as receita,
                SUM(amount) * 0.4901 as comissao
            FROM orders
            WHERE status = 'PAID'
              AND referrer_id LIKE '%${phone}%'
        `);

        const vd = vendasDiretas.rows[0];

        console.log('\n💵 VENDAS DIRETAS (Comissão 49.01%):');
        console.log(`   Tickets Vendidos: ${vd.tickets}`);
        console.log(`   Clientes Únicos: ${vd.clientes}`);
        console.log(`   Rifas: ${vd.rifas}`);
        console.log(`   Receita Total: R$ ${parseFloat(vd.receita || 0).toFixed(2)}`);
        console.log(`   Comissão: R$ ${parseFloat(vd.comissao || 0).toFixed(2)}`);

        // Sub-afiliados
        const subs = await client.query(`
            SELECT 
                COUNT(o.order_id) as tickets,
                SUM(o.amount) as receita,
                SUM(o.amount) * 0.25 as comissao
            FROM sub_affiliates sa
            LEFT JOIN orders o ON o.referrer_id = sa.sub_code AND o.status = 'PAID'
            WHERE sa.parent_phone = $1
        `, [phone]);

        const vs = subs.rows[0];

        console.log('\n👥 VENDAS SUB-AFILIADOS (Comissão 25%):');
        console.log(`   Tickets Vendidos: ${vs.tickets}`);
        console.log(`   Receita Total: R$ ${parseFloat(vs.receita || 0).toFixed(2)}`);
        console.log(`   Comissão: R$ ${parseFloat(vs.comissao || 0).toFixed(2)}`);

        // TOTAL
        const receitaTotal = parseFloat(vd.receita || 0) + parseFloat(vs.receita || 0);
        const comissaoTotal = parseFloat(vd.comissao || 0) + parseFloat(vs.comissao || 0);

        console.log('\n' + '═'.repeat(70));
        console.log('📊 TOTAIS:');
        console.log('═'.repeat(70));
        console.log(`VALOR TOTAL VENDIDO: R$ ${receitaTotal.toFixed(2)}`);
        console.log(`COMISSÃO TOTAL: R$ ${comissaoTotal.toFixed(2)}`);
        console.log('═'.repeat(70));

        await client.end();
    } catch (e) {
        console.error('Erro:', e.message);
    }
}

main();
