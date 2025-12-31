const { query } = require('./src/database/db');

async function revalidate() {
    console.log('--- REVALIDATION: All Active & Validated Payments ---');
    const CAMPAIGN_ID = 21;

    try {
        // 1. Get all PAID claims
        console.log('Fetching all PAID claims for Campaign 21...');
        const claims = await query(`
            SELECT id, name, phone, total_qty, claimed_at as created_at, round_number 
            FROM az_claims 
            WHERE campaign_id=$1 AND status='PAID' 
            ORDER BY id ASC
        `, [CAMPAIGN_ID]);

        console.log(`Found ${claims.rows.length} PAID claims.`);

        let okCount = 0;
        let errorCount = 0;
        let totalTickets = 0;

        // 2. Iterate and Verify Tickets for each
        for (const claim of claims.rows) {
            const tickets = await query(`
                SELECT id, number, status, round_number 
                FROM az_tickets 
                WHERE assigned_claim_id=$1
            `, [claim.id]);

            const ticketCount = tickets.rows.length;
            const expected = claim.total_qty;

            // Check 1: Quantity Match
            if (ticketCount !== expected) {
                console.error(`❌ ERROR: Claim ${claim.id} (${claim.name}) paid for ${expected} but has ${ticketCount} tickets!`);
                errorCount++;
                continue;
            }

            // Check 2: Status Match
            const badTickets = tickets.rows.filter(t => t.status !== 'ASSIGNED');
            if (badTickets.length > 0) {
                console.error(`❌ ERROR: Claim ${claim.id} has tickets that are NOT 'ASSIGNED':`, badTickets);
                errorCount++;
                continue;
            }

            // Check 3: Round Consistency (Optional but good)
            // Some claims might be in R1 (Archives) but tickets are R1. 
            // If we moved claim to R1, tickets should be R1.
            const mismatchRound = tickets.rows.filter(t => t.round_number !== claim.round_number);
            if (mismatchRound.length > 0) {
                console.warn(`⚠️ WARNING: Claim ${claim.id} is Round ${claim.round_number} but tickets are Round ${mismatchRound[0].round_number}`);
                // This might be okay if we have cross-round logic, but usually should match.
                // In our consolidations, we updated both claim and tickets, so they should match.
            }

            okCount++;
            totalTickets += ticketCount;
        }

        console.log('-'.repeat(50));
        console.log(`✅ VALIDATED: ${okCount} Claims`);
        console.log(`❌ ERRORS:    ${errorCount} Claims`);
        console.log(`🎟️ TOTAL TICKETS SECURE: ${totalTickets}`);
        console.log('-'.repeat(50));

    } catch (e) {
        console.error(e);
    }
}
revalidate();
