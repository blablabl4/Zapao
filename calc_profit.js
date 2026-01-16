require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function calculateProfit() {
    try {
        // Today's date range (Brazil timezone)
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

        console.log(`\n=== Lucro do Dia ${today.toLocaleDateString('pt-BR')} ===\n`);

        // 1. Get revenue from paid orders today
        const revenueRes = await pool.query(`
            SELECT 
                SUM(amount) as total_revenue,
                COUNT(*) as total_orders,
                COUNT(DISTINCT draw_id) as draws_count
            FROM orders 
            WHERE status = 'PAID' 
            AND created_at >= $1 AND created_at <= $2
        `, [startOfDay, endOfDay]);

        const revenue = parseFloat(revenueRes.rows[0].total_revenue) || 0;
        const ordersCount = parseInt(revenueRes.rows[0].total_orders) || 0;

        console.log(`💰 Receita Total: R$ ${revenue.toFixed(2)} (${ordersCount} tickets)`);

        // 2. Get prizes paid today (from draws closed today)
        const prizesRes = await pool.query(`
            SELECT 
                SUM(prize_base) as total_prizes,
                COUNT(*) as draws_closed
            FROM draws 
            WHERE status = 'CLOSED' 
            AND closed_at >= $1 AND closed_at <= $2
        `, [startOfDay, endOfDay]);

        const prizes = parseFloat(prizesRes.rows[0].total_prizes) || 0;
        const drawsClosed = parseInt(prizesRes.rows[0].draws_closed) || 0;

        console.log(`🏆 Prêmios (${drawsClosed} rifas): R$ ${prizes.toFixed(2)}`);

        // 3. Calculate commissions on today's sales
        // Get all referrer sales today
        const commissionRes = await pool.query(`
            SELECT 
                referrer_id,
                SUM(amount) as total
            FROM orders 
            WHERE status = 'PAID' 
            AND referrer_id IS NOT NULL 
            AND referrer_id != ''
            AND created_at >= $1 AND created_at <= $2
            GROUP BY referrer_id
        `, [startOfDay, endOfDay]);

        let totalCommissions = 0;
        const platformFee = 0.0099;

        for (const row of commissionRes.rows) {
            const saleAmount = parseFloat(row.total);
            const netSale = saleAmount * (1 - platformFee);

            // Check if it's a sub-affiliate
            const subCheck = await pool.query(
                "SELECT * FROM sub_affiliates WHERE sub_code = $1",
                [row.referrer_id]
            );

            if (subCheck.rows.length > 0) {
                // Sub-affiliate: 25% to sub + 25% to parent = 50% total
                totalCommissions += netSale * 0.50;
            } else {
                // Main affiliate: 50%
                totalCommissions += netSale * 0.50;
            }
        }

        console.log(`💸 Comissões Afiliados: R$ ${totalCommissions.toFixed(2)}`);

        // 4. Calculate net profit
        const breakeven = prizes + totalCommissions;
        const profit = revenue - breakeven;

        console.log(`\n========================================`);
        console.log(`📊 Ponto de Equilíbrio: R$ ${breakeven.toFixed(2)}`);
        console.log(`\n💵 LUCRO LÍQUIDO: R$ ${profit.toFixed(2)}`);
        console.log(`========================================\n`);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

calculateProfit();
