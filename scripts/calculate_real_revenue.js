require('dotenv').config();
const { query } = require('../src/database/db');

async function calculateRevenue() {
    try {
        const startDate = '2026-01-02 00:00:00';
        console.log(`Calculating revenue since: ${startDate}`);

        const result = await query(`
            SELECT 
                COUNT(*) as total_orders,
                COALESCE(SUM(amount), 0) as total_revenue,
                COUNT(DISTINCT buyer_ref) as unique_buyers
            FROM orders 
            WHERE status = 'PAID' 
            AND created_at >= $1
        `, [startDate]);

        const stats = result.rows[0];
        console.log('--- TOTALS ---');
        console.log(`Orders: ${stats.total_orders}`);
        console.log(`Revenue: R$ ${parseFloat(stats.total_revenue).toFixed(2)}`);
        console.log(`Unique Buyers: ${stats.unique_buyers}`);

        // Daily breakdown
        const dailyIds = await query(`
            SELECT 
                DATE(created_at) as sale_date,
                SUM(amount) as daily_revenue,
                COUNT(*) as daily_count
            FROM orders
            WHERE status = 'PAID'
            AND created_at >= $1
            GROUP BY DATE(created_at)
            ORDER BY sale_date ASC
        `, [startDate]);

        console.log('\n--- DAILY ---');
        dailyIds.rows.forEach(r => {
            console.log(`${new Date(r.sale_date).toISOString().split('T')[0]}: R$ ${parseFloat(r.daily_revenue).toFixed(2)} (${r.daily_count} orders)`);
        });

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

calculateRevenue();
