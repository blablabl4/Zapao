const { query } = require('../src/database/db');

async function dailyReport() {
    try {
        console.log(`📊 GERANDO RELATÓRIO DIÁRIO (Fuso Horário: São Paulo)...\n`);

        // 1. REVENUE by Date (using paid_at)
        const revRes = await query(`
            SELECT 
                DATE(p.paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') as day,
                COUNT(*) as sales_count, 
                COALESCE(SUM(o.amount), 0) as total_revenue
            FROM payments p
            JOIN orders o ON p.order_id = o.order_id
            GROUP BY day
            ORDER BY day DESC
        `);

        // 2. PRIZES by Date (using closed_at)
        const prizeRes = await query(`
            SELECT 
                DATE(closed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') as day,
                SUM(payout_each * winners_count) as total_prizes,
                COUNT(*) as draws_count
            FROM draws
            WHERE status = 'CLOSED' OR winners_count > 0
            GROUP BY day
            ORDER BY day DESC
        `);

        // 3. Merge Data
        const report = {};

        revRes.rows.forEach(r => {
            const d = r.day.toISOString().split('T')[0];
            if (!report[d]) report[d] = { revenue: 0, prizes: 0, sales: 0, draws: 0 };
            report[d].revenue = parseFloat(r.total_revenue);
            report[d].sales = parseInt(r.sales_count);
        });

        prizeRes.rows.forEach(r => {
            const d = r.day.toISOString().split('T')[0];
            if (!report[d]) report[d] = { revenue: 0, prizes: 0, sales: 0, draws: 0 };
            report[d].prizes = parseFloat(r.total_prizes);
            report[d].draws = parseInt(r.draws_count);
        });

        // 4. Print Table
        console.log(`DATA        | FATURAMENTO  | PRÊMIOS PAGOS | LUCRO DO DIA`);
        console.log(`------------|--------------|---------------|--------------`);

        const sortedDates = Object.keys(report).sort().reverse();

        let totalRev = 0;
        let totalPrize = 0;

        sortedDates.forEach(date => {
            const r = report[date];
            const balance = r.revenue - r.prizes;

            totalRev += r.revenue;
            totalPrize += r.prizes;

            const dateStr = date.split('-').reverse().join('/'); // DD/MM/YYYY
            const revStr = `R$ ${r.revenue.toFixed(2)}`.padEnd(12);
            const prizeStr = `R$ ${r.prizes.toFixed(2)}`.padEnd(13);
            const balStr = `R$ ${balance.toFixed(2)}`;

            console.log(`${dateStr}  | ${revStr} | ${prizeStr} | ${balStr}`);
        });

        console.log(`------------|--------------|---------------|--------------`);
        const finalBal = totalRev - totalPrize;
        console.log(`TOTAL       | R$ ${totalRev.toFixed(2).padEnd(9)} | R$ ${totalPrize.toFixed(2).padEnd(10)} | R$ ${finalBal.toFixed(2)}`);

    } catch (e) {
        console.error("Erro:", e);
    } finally {
        process.exit();
    }
}

dailyReport();
