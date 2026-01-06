const { query } = require('../src/database/db');

async function checkAllAffiliates() {
    try {
        // Check ALL clicks
        console.log('=== TODOS OS CLIQUES DE AFILIADOS ===\n');
        const allClicks = await query(`
            SELECT ac.draw_id, d.draw_name, ac.referrer_id, COUNT(*) as clicks
            FROM affiliate_clicks ac
            JOIN draws d ON ac.draw_id = d.id
            GROUP BY ac.draw_id, d.draw_name, ac.referrer_id
            ORDER BY ac.draw_id DESC, clicks DESC
        `);

        if (allClicks.rows.length === 0) {
            console.log('Nenhum clique registrado em nenhuma rifa');
        } else {
            allClicks.rows.forEach(r => {
                console.log(`Rifa ${r.draw_id} (${r.draw_name}): ${r.referrer_id.substring(0, 15)}... = ${r.clicks} cliques`);
            });
        }

        // Check ALL sales with referrer
        console.log('\n=== TODAS AS VENDAS COM REFERRER ===\n');
        const allSales = await query(`
            SELECT o.draw_id, d.draw_name, o.referrer_id, COUNT(*) as tickets, SUM(o.amount) as revenue
            FROM orders o
            JOIN draws d ON o.draw_id = d.id
            WHERE o.status = 'PAID' AND o.referrer_id IS NOT NULL AND o.referrer_id != ''
            GROUP BY o.draw_id, d.draw_name, o.referrer_id
            ORDER BY o.draw_id DESC, tickets DESC
        `);

        if (allSales.rows.length === 0) {
            console.log('Nenhuma venda com referrer em nenhuma rifa');
        } else {
            allSales.rows.forEach(r => {
                console.log(`Rifa ${r.draw_id} (${r.draw_name}): ${r.referrer_id.substring(0, 15)}... = ${r.tickets} tickets, R$ ${parseFloat(r.revenue).toFixed(2)}`);
            });
        }

        // Show total counts
        const totalClicksRes = await query(`SELECT COUNT(*) as total FROM affiliate_clicks`);
        const totalSalesRes = await query(`SELECT COUNT(*) as total FROM orders WHERE referrer_id IS NOT NULL AND referrer_id != ''`);

        console.log('\n=== TOTAIS GLOBAIS ===');
        console.log(`Total de cliques registrados (todas rifas): ${totalClicksRes.rows[0].total}`);
        console.log(`Total de vendas com referrer (todas rifas): ${totalSalesRes.rows[0].total}`);

        // Check when affiliate_clicks table was created
        console.log('\n=== INFO DA TABELA affiliate_clicks ===');
        const tableInfo = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'affiliate_clicks'
        `);
        console.log('Colunas:', tableInfo.rows.map(r => r.column_name).join(', '));

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        process.exit();
    }
}

checkAllAffiliates();
