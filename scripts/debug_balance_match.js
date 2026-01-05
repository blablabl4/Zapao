const { query, pool } = require('../src/database/db');
require('dotenv').config();

async function debugBalance() {
    try {
        console.log('🔍 Searching for Financial Match (Target: ~1331.18)...');

        // Scenarios to test
        const dates = [
            '2030-01-01', // Future (All Time)
            '2026-01-05', // Today
            '2026-01-02', // Before Jan 3rd
            '2026-01-01', // Start of Year
            '2025-12-31', // End of 2025
        ];

        for (const d of dates) {
            // 1. Revenue
            // Note: admin.js uses 0.99% fee estimation.
            const revSql = `
                SELECT SUM(amount_paid) as total 
                FROM payments 
                WHERE paid_at <= '${d} 23:59:59-03'
            `;
            const revRes = await query(revSql);
            const revenue = parseFloat(revRes.rows[0].total || 0);

            // 2. Fees (0.99%)
            // Some old payments might be manually fixed (fee=0?), but admin.js uses flat rate estimate usually?
            // "totalFees" in admin.js is "totalRevenue * 0.0099" (approx).
            const fees = revenue * 0.0099;

            // 3. Prizes
            const przSql = `
                SELECT SUM(payout_each * winners_count) as total
                FROM draws 
                WHERE (status = 'CLOSED' OR winners_count > 0)
                AND closed_at <= '${d} 23:59:59-03'
            `;
            const przRes = await query(przSql);
            const prizes = parseFloat(przRes.rows[0].total || 0);

            const net = revenue - prizes - fees;

            console.log(`[Limit: ${d}] Rev: ${revenue.toFixed(2)} | Prizes: ${prizes.toFixed(2)} | Fees: ${fees.toFixed(2)} | NET: ${net.toFixed(2)}`);
        }

        setTimeout(() => process.exit(0), 1000);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

debugBalance();
