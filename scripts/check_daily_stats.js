const { query } = require('../src/database/db');

async function checkDailyStats() {
    try {
        // Define "Today" range (UTC-3 likely, but let's just grab everything from 2026-01-04 00:00:00)
        // User's current time is 2026-01-04 T20:27
        const startOfDay = '2026-01-04 00:00:00';
        const endOfDay = '2026-01-04 23:59:59';

        console.log(`Checking stats for: ${startOfDay} to ${endOfDay}`);

        // 1. Count Unique Buyers (by Phone) who paid TODAY
        // Join orders and payments to get buyer_ref and paid_at
        const uniqueRes = await query(`
            SELECT COUNT(DISTINCT split_part(o.buyer_ref, '|', 2)) as unique_count 
            FROM orders o
            JOIN payments p ON o.order_id = p.order_id
            WHERE p.paid_at >= $1 AND p.paid_at <= $2
        `, [startOfDay, endOfDay]);

        // 2. Count Total Payments Today
        const totalRes = await query(`
            SELECT COUNT(*) as total_count, COALESCE(SUM(o.amount), 0) as total_revenue
            FROM orders o
            JOIN payments p ON o.order_id = p.order_id
            WHERE p.paid_at >= $1 AND p.paid_at <= $2
        `, [startOfDay, endOfDay]);

        // 3. Breakdown by Raffle
        const breakdownRes = await query(`
            SELECT d.draw_name, COUNT(DISTINCT split_part(o.buyer_ref, '|', 2)) as unique_buyers
            FROM orders o
            JOIN payments p ON o.order_id = p.order_id
            JOIN draws d ON o.draw_id = d.id
            WHERE p.paid_at >= $1 AND p.paid_at <= $2
            GROUP BY d.draw_name
        `, [startOfDay, endOfDay]);

        const uniqueCount = uniqueRes.rows[0].unique_count;
        const totalCount = totalRes.rows[0].total_count;
        const revenue = totalRes.rows[0].total_revenue;

        console.log(`\n=== ESTATÍSTICAS DE HOJE (04/01/2026) ===`);
        console.log(`👥 Clientes Únicos: ${uniqueCount}`);
        console.log(`✅ Pagamentos Totais: ${totalCount}`);
        console.log(`💰 Receita do Dia: R$ ${parseFloat(revenue).toFixed(2)}`);

        console.log(`\n--- Por Sorteio ---`);
        breakdownRes.rows.forEach(row => {
            console.log(`- ${row.draw_name}: ${row.unique_buyers} clientes únicos`);
        });

    } catch (e) {
        console.error("Erro:", e);
    } finally {
        process.exit();
    }
}

checkDailyStats();
