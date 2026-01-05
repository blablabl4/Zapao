const { query, pool } = require('../src/database/db');
require('dotenv').config();

async function debugExtra() {
    try {
        console.log('🔍 Analyzing "Extra" Revenue (Not in Closed Draws)...');

        // 1. Total System Net (All payments - All prizes - Fees)
        // Fees = 0.99% of Revenue
        const sysSql = `
            SELECT SUM(amount_paid) as rev FROM payments
        `;
        const sysRes = await query(sysSql);
        const totalRev = parseFloat(sysRes.rows[0].rev || 0);

        const przSql = `
            SELECT SUM(payout_each * winners_count) as prz FROM draws WHERE status='CLOSED' OR winners_count > 0
        `;
        const przRes = await query(przSql);
        const totalPrize = parseFloat(przRes.rows[0].prz || 0);

        const totalFee = totalRev * 0.0099;
        const totalNet = totalRev - totalPrize - totalFee;

        console.log(`SYSTEM ALL-TIME NET: ${totalNet.toFixed(2)} (Rev ${totalRev} - Prize ${totalPrize} - Fee ${totalFee.toFixed(2)})`);

        // 2. Closed Draw Net (Calculated previously as ~1252)
        // We do this by summing payments linked to closed draws
        const closedSql = `
            SELECT SUM(p.amount_paid) as rev
            FROM payments p
            JOIN orders o ON p.order_id = o.order_id
            JOIN draws d ON o.draw_id = d.id
            WHERE d.status = 'CLOSED'
        `;
        const closedRes = await query(closedSql);
        const closedRev = parseFloat(closedRes.rows[0].rev || 0);

        // Prize is same (assuming only closed draws have prizes)
        const closedFee = closedRev * 0.0099;
        const closedNet = closedRev - totalPrize - closedFee;

        console.log(`CLOSED DRAWS NET: ${closedNet.toFixed(2)} (Rev ${closedRev} - Prize ${totalPrize})`);

        // 3. Difference
        console.log(`DIFFERENCE: ${(totalNet - closedNet).toFixed(2)}`);

        // 4. Sources of Difference
        const diffSql = `
            SELECT 
                d.id, d.draw_name, d.status, SUM(p.amount_paid) as rev
            FROM payments p
            JOIN orders o ON p.order_id = o.order_id
            JOIN draws d ON o.draw_id = d.id
            WHERE d.status != 'CLOSED'
            GROUP BY d.id
        `;
        const diffRes = await query(diffSql);
        console.log('--- ACTIVE/OPEN SOURCES ---');
        console.table(diffRes.rows);

        setTimeout(() => process.exit(0), 1000);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

debugExtra();
