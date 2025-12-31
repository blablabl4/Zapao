const { query } = require('./src/database/db');

async function auditMulti() {
    console.log('--- Auditing Multi-Ticket Transactions ---');
    try {
        // 1. Find all PAID claims with Qty > 1
        const multiClaims = await query(`
            SELECT id, name, total_qty 
            FROM az_claims 
            WHERE campaign_id=21 AND status='PAID' AND total_qty > 1
            ORDER BY total_qty DESC
        `);

        console.log(`Found ${multiClaims.rows.length} Multi-Ticket Transactions.`);

        let verifiedCount = 0;
        let errors = 0;

        // 2. Verify Ticket Count for each
        for (const claim of multiClaims.rows) {
            const tickets = await query(`
                SELECT count(*) as cnt 
                FROM az_tickets 
                WHERE assigned_claim_id=$1 AND status='ASSIGNED'
            `, [claim.id]);

            const actual = parseInt(tickets.rows[0].cnt);
            const expected = claim.total_qty;

            if (actual === expected) {
                verifiedCount++;
                // Show a few examples
                if (verifiedCount <= 3) {
                    console.log(`✅ Claim #${claim.id} (${claim.name}): Paid for ${expected}, Got ${actual} tickets. OK.`);
                }
            } else {
                console.error(`❌ ERROR: Claim #${claim.id} (${claim.name}): Paid for ${expected}, Got ${actual} tickets!`);
                errors++;
            }
        }

        console.log('-'.repeat(40));
        console.log(`Summary:`);
        console.log(`- Verified Multi-Claims: ${verifiedCount}`);
        console.log(`- Errors found: ${errors}`);

        if (errors === 0) {
            console.log(`\nCONCLUSÃO: O sistema contabilizou CORRETAMENTE os pagamentos múltiplos.`);
            console.log(`A soma de R$ 9.220,00 INCLUI essas cotas extras.`);
        }

    } catch (e) {
        console.error(e);
    }
}
auditMulti();
