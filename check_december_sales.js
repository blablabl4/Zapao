const { query } = require('./src/database/db');

async function checkDec() {
    console.log('--- Analyzing December Sales Context ---');
    try {
        // 1. Campaign 21 (PAID) - We know this is ~9220
        const c21Paid = await query("SELECT sum(total_qty) as qty FROM az_claims WHERE campaign_id=21 AND status='PAID'");
        const qty21 = parseInt(c21Paid.rows[0].qty || 0);
        console.log(`Campaign 21 (PAID): ${qty21} quotas (R$ ${(qty21 * 20).toFixed(2)})`);

        // 2. Campaign 21 (PENDING)
        const c21Pending = await query("SELECT sum(total_qty) as qty FROM az_claims WHERE campaign_id=21 AND status='PENDING'");
        const qty21Pend = parseInt(c21Pending.rows[0].qty || 0);
        console.log(`Campaign 21 (PENDING): ${qty21Pend} quotas (R$ ${(qty21Pend * 20).toFixed(2)})`);

        // 3. Other Campaigns (PAID) in December?
        // Assuming IDs != 21
        const otherPaid = await query("SELECT campaign_id, sum(total_qty) as qty FROM az_claims WHERE campaign_id != 21 AND status='PAID' AND claimed_at > '2025-12-01' GROUP BY campaign_id");
        console.log('Other Campaigns (Dec):');
        console.table(otherPaid.rows);

        // 4. Total Math
        const target = 10340;
        const calcQuota = target / 20;
        console.log(`\nUser Target: R$ ${target} = ${calcQuota} quotas (at R$ 20.00)`);

    } catch (e) {
        console.error(e);
    }
}
checkDec();
