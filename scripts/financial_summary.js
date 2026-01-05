const { query } = require('../src/database/db');

async function financialSummary() {
    try {
        const startOfDay = '2026-01-04 00:00:00';
        const endOfDay = '2026-01-04 23:59:59';

        console.log(`📊 Validando finanças de HOJE (04/01/2026)...\n`);

        // 1. REVENUE (Faturamento) por RIFA
        const revRes = await query(`
            SELECT d.draw_name, COUNT(*) as sales_count, COALESCE(SUM(o.amount), 0) as total_revenue
            FROM orders o
            JOIN payments p ON o.order_id = p.order_id
            JOIN draws d ON o.draw_id = d.id
            WHERE p.paid_at >= $1 AND p.paid_at <= $2
            GROUP BY d.draw_name
        `, [startOfDay, endOfDay]);

        // Map data
        const summary = {};

        revRes.rows.forEach(r => {
            const name = r.draw_name;
            if (!summary[name]) summary[name] = { revenue: 0, prizes: 0, count: 0 };
            summary[name].revenue = parseFloat(r.total_revenue);
            summary[name].count = parseInt(r.sales_count);
        });

        // 2. PRIZES (Prêmios)
        const prizeRes = await query(`
            SELECT draw_name, winners_count, payout_each
            FROM draws
            WHERE status = 'CLOSED' 
              AND closed_at >= $1 AND closed_at <= $2
        `, [startOfDay, endOfDay]);

        prizeRes.rows.forEach(d => {
            const name = d.draw_name;
            if (!summary[name]) summary[name] = { revenue: 0, prizes: 0, count: 0 };
            const payout = parseFloat(d.payout_each) * parseInt(d.winners_count || 0);
            summary[name].prizes = payout;
        });

        console.log(`\n===========================================`);
        console.log(`     RELATÓRIO DETALHADO (04/01/2026)      `);
        console.log(`===========================================\n`);

        let totalRev10 = 0;
        let totalPrize10 = 0;
        let totalRevAll = 0;
        let totalPrizeAll = 0;

        Object.keys(summary).forEach(name => {
            const s = summary[name];
            const balance = s.revenue - s.prizes;

            totalRevAll += s.revenue;
            totalPrizeAll += s.prizes;

            // Check if Rifa >= 10
            const match = name.match(/(\d+)/);
            if (match && parseInt(match[1]) >= 10) {
                totalRev10 += s.revenue;
                totalPrize10 += s.prizes;
            }

            console.log(`📌 ${name}`);
            console.log(`   💰 Vendas:  R$ ${s.revenue.toFixed(2)} (${s.count} un)`);
            console.log(`   🎁 Prêmios: R$ ${s.prizes.toFixed(2)}`);
            console.log(`   📉 Saldo:   R$ ${balance.toFixed(2)}`);
            console.log(`   -----------------`);
        });

        const profitAll = totalRevAll - totalPrizeAll;
        const profit10 = totalRev10 - totalPrize10;

        console.log(`\n=== RESUMO GERAL ===`);
        console.log(`Total Vendas:  R$ ${totalRevAll.toFixed(2)}`);
        console.log(`Total Prêmios: R$ ${totalPrizeAll.toFixed(2)}`);
        console.log(`LUCRO TOTAL:   R$ ${profitAll.toFixed(2)}`);

        console.log(`\n=== APENAS RIFAS 10+ (Hoje) ===`);
        console.log(`Total Vendas:  R$ ${totalRev10.toFixed(2)}`);
        console.log(`Total Prêmios: R$ ${totalPrize10.toFixed(2)}`);
        console.log(`LUCRO (10+):   R$ ${profit10.toFixed(2)}`);

    } catch (e) {
        console.error("Erro:", e);
    } finally {
        process.exit();
    }
}

financialSummary();
