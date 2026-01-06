const { query } = require('../src/database/db');

async function checkAffiliates() {
    try {
        // Get current active draw
        const drawRes = await query(`SELECT id, draw_name FROM draws WHERE status = 'ACTIVE' LIMIT 1`);

        if (drawRes.rows.length === 0) {
            console.log('Nenhuma rifa ativa encontrada');
            return;
        }

        const draw = drawRes.rows[0];
        console.log(`\n=== RIFA ATIVA: ${draw.draw_name} (ID: ${draw.id}) ===\n`);

        // Check clicks
        const clicks = await query(`
            SELECT referrer_id, COUNT(*) as click_count 
            FROM affiliate_clicks 
            WHERE draw_id = $1 
            GROUP BY referrer_id
            ORDER BY click_count DESC
        `, [draw.id]);

        console.log('CLIQUES POR REFERRER:');
        if (clicks.rows.length === 0) {
            console.log('  Nenhum clique registrado');
        } else {
            clicks.rows.forEach(r => {
                console.log(`  - ${r.referrer_id.substring(0, 20)}... : ${r.click_count} cliques`);
            });
        }

        // Check sales
        const sales = await query(`
            SELECT referrer_id, COUNT(*) as ticket_count, SUM(amount) as revenue 
            FROM orders 
            WHERE draw_id = $1 AND status = 'PAID' AND referrer_id IS NOT NULL AND referrer_id != ''
            GROUP BY referrer_id
            ORDER BY ticket_count DESC
        `, [draw.id]);

        console.log('\nVENDAS POR REFERRER:');
        if (sales.rows.length === 0) {
            console.log('  Nenhuma venda com referrer');
        } else {
            sales.rows.forEach(r => {
                console.log(`  - ${r.referrer_id.substring(0, 20)}... : ${r.ticket_count} tickets, R$ ${parseFloat(r.revenue).toFixed(2)}`);
            });
        }

        // Total summary
        const totalClicks = await query(`SELECT COUNT(*) as total FROM affiliate_clicks WHERE draw_id = $1`, [draw.id]);
        const totalSales = await query(`SELECT COUNT(*) as total FROM orders WHERE draw_id = $1 AND status = 'PAID' AND referrer_id IS NOT NULL AND referrer_id != ''`, [draw.id]);

        console.log('\n=== RESUMO ===');
        console.log(`Total de cliques registrados: ${totalClicks.rows[0].total}`);
        console.log(`Total de vendas com referrer: ${totalSales.rows[0].total}`);
        console.log(`Referrers únicos (cliques): ${clicks.rows.length}`);
        console.log(`Referrers únicos (vendas): ${sales.rows.length}`);

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        process.exit();
    }
}

checkAffiliates();
