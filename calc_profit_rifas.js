require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function calculateProfitByRaffle() {
    try {
        // rifa 23 = ID 31, Rifa 24 = ID 32, Rifa 25 = ID 33
        const raffleNames = ['rifa 23', 'Rifa 24', 'Rifa 25'];

        console.log(`\n=== LUCRO POR RIFA (23, 24, 25) ===\n`);

        const platformFee = 0.0099;
        let grandRevenue = 0, grandPrizes = 0, grandCommissions = 0;

        for (const raffleName of raffleNames) {
            // Get draw info
            const drawRes = await pool.query(
                "SELECT * FROM draws WHERE draw_name ILIKE $1",
                [`%${raffleName}%`]
            );

            if (drawRes.rows.length === 0) continue;
            const draw = drawRes.rows[0];

            // Get revenue
            const revenueRes = await pool.query(`
                SELECT SUM(amount) as total, COUNT(*) as count
                FROM orders WHERE draw_id = $1 AND status = 'PAID'
            `, [draw.id]);

            const revenue = parseFloat(revenueRes.rows[0].total) || 0;
            const tickets = parseInt(revenueRes.rows[0].count) || 0;

            // Get prize
            const prize = parseFloat(draw.prize_base) || 0;

            // Get commissions for this draw
            const commRes = await pool.query(`
                SELECT referrer_id, SUM(amount) as total
                FROM orders 
                WHERE draw_id = $1 AND status = 'PAID' 
                AND referrer_id IS NOT NULL AND referrer_id != ''
                GROUP BY referrer_id
            `, [draw.id]);

            let commissions = 0;
            for (const row of commRes.rows) {
                const netSale = parseFloat(row.total) * (1 - platformFee);
                commissions += netSale * 0.50;
            }

            const profit = revenue - prize - commissions;

            console.log(`📍 ${draw.draw_name} (ID: ${draw.id})`);
            console.log(`   💰 Receita: R$ ${revenue.toFixed(2)} (${tickets} tickets)`);
            console.log(`   🏆 Prêmio: R$ ${prize.toFixed(2)}`);
            console.log(`   💸 Comissões: R$ ${commissions.toFixed(2)}`);
            console.log(`   💵 Lucro: R$ ${profit.toFixed(2)}`);
            console.log('');

            grandRevenue += revenue;
            grandPrizes += prize;
            grandCommissions += commissions;
        }

        const grandProfit = grandRevenue - grandPrizes - grandCommissions;

        console.log(`========================================`);
        console.log(`📊 TOTAL DAS 3 RIFAS:`);
        console.log(`   💰 Receita: R$ ${grandRevenue.toFixed(2)}`);
        console.log(`   🏆 Prêmios: R$ ${grandPrizes.toFixed(2)}`);
        console.log(`   💸 Comissões: R$ ${grandCommissions.toFixed(2)}`);
        console.log(`   💵 LUCRO: R$ ${grandProfit.toFixed(2)}`);
        console.log(`========================================\n`);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

calculateProfitByRaffle();
