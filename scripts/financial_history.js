const { query } = require('../src/database/db');

async function financialHistory() {
    try {
        console.log(`📊 RELATÓRIO GERAL (HISTÓRICO COMPLETO)...\n`);

        // 1. REVENUE (Faturamento) por RIFA
        const revRes = await query(`
            SELECT d.draw_name, COUNT(o.order_id) as sales_count, COALESCE(SUM(o.amount), 0) as total_revenue
            FROM draws d
            LEFT JOIN orders o ON d.id = o.draw_id AND o.status = 'PAID'
            GROUP BY d.id, d.draw_name
            ORDER BY d.created_at ASC
        `);

        const summary = {};

        revRes.rows.forEach(r => {
            const name = r.draw_name;
            if (!summary[name]) summary[name] = { revenue: 0, prizes: 0, count: 0 };
            summary[name].revenue = parseFloat(r.total_revenue);
            summary[name].count = parseInt(r.sales_count);
        });

        // 2. PRIZES (Prêmios)
        const prizeRes = await query(`
            SELECT draw_name, winners_count, payout_each, status
            FROM draws
            WHERE status = 'CLOSED' OR winners_count > 0
        `);

        prizeRes.rows.forEach(d => {
            const name = d.draw_name;
            if (!summary[name]) summary[name] = { revenue: 0, prizes: 0, count: 0 };
            const payout = parseFloat(d.payout_each) * parseInt(d.winners_count || 0);
            summary[name].prizes = payout;
        });

        console.log(`\n===========================================`);
        console.log(`       HISTÓRICO DE TODAS AS RIFAS         `);
        console.log(`===========================================\n`);

        let totalRev = 0;
        let totalPrize = 0;

        let totalRev10 = 0;
        let totalPrize10 = 0;

        // Custom sort order (numeric if possible)
        const sortedKeys = Object.keys(summary).sort((a, b) => {
            const numA = (a.match(/(\d+)/) || [0, 0])[1];
            const numB = (b.match(/(\d+)/) || [0, 0])[1];
            return parseInt(numA) - parseInt(numB);
        });

        sortedKeys.forEach(name => {
            const s = summary[name];
            const balance = s.revenue - s.prizes;

            totalRev += s.revenue;
            totalPrize += s.prizes;

            // Check if Rifa >= 10
            const match = name.match(/(\d+)/);
            if (match && parseInt(match[1]) >= 10) {
                totalRev10 += s.revenue;
                totalPrize10 += s.prizes;
            }

            console.log(`📌 ${name}`);
            console.log(`   💰 Faturado: R$ ${s.revenue.toFixed(2)} (${s.count} vendas)`);
            console.log(`   🎁 Prêmios:  R$ ${s.prizes.toFixed(2)}`);
            console.log(`   📉 Lucro:    R$ ${balance.toFixed(2)}`);
            console.log(`   -----------------`);
        });

        const profit = totalRev - totalPrize;
        const margin = totalRev > 0 ? (profit / totalRev) * 100 : 0;

        const profit10 = totalRev10 - totalPrize10;

        console.log(`\n=== RESUMO GLOBAL (Desde o início) ===`);
        console.log(`TOTAL Vendas:   R$ ${totalRev.toFixed(2)}`);
        console.log(`TOTAL Prêmios:  R$ ${totalPrize.toFixed(2)}`);
        console.log(`LUCRO LIQUIDO:  R$ ${profit.toFixed(2)} (${margin.toFixed(1)}%)`);

        console.log(`\n=== RESUMO (Rifas 10+) ===`);
        console.log(`LUCRO (10+):    R$ ${profit10.toFixed(2)}`);

    } catch (e) {
        console.error("Erro:", e);
    } finally {
        process.exit();
    }
}

financialHistory();
