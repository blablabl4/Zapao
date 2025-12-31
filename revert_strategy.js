const { query } = require('./src/database/db');

async function revert() {
    console.log('--- Reverting Consolidation & Redistributing ---');
    const CAMPAIGN_ID = 21;

    try {
        await query('BEGIN');

        // 1. Fetch Active R1 Claims (Assigned tickets)
        // We only care about what is currently holding a valid ticket.
        const r1Assigned = await query(`
            SELECT c.id, c.type, t.id as ticket_id
            FROM az_claims c
            JOIN az_tickets t ON t.assigned_claim_id = c.id
            WHERE t.campaign_id=$1 AND t.round_number=1
        `, [CAMPAIGN_ID]);

        const orphans = [];
        const toMoveFromR1 = [];

        r1Assigned.rows.forEach(row => {
            if (row.type === 'REDIST_R1' || row.type === 'RECOVERY') {
                orphans.push(row);
            } else {
                toMoveFromR1.push(row);
            }
        });

        console.log(`Round 1 Analysis:`);
        console.log(`- Orphans (Stay): ${orphans.length}`);
        console.log(`- Sales (Move): ${toMoveFromR1.length}`);

        // 2. Fetch Active R5 Claims
        const r5Assigned = await query(`
            SELECT c.id, c.type, t.id as ticket_id
            FROM az_claims c
            JOIN az_tickets t ON t.assigned_claim_id = c.id
            WHERE t.campaign_id=$1 AND t.round_number=5
        `, [CAMPAIGN_ID]);

        const toMoveFromR5 = r5Assigned.rows;
        console.log(`Round 5 Analysis:`);
        console.log(`- Sales (Pool): ${toMoveFromR5.length}`);

        // 3. Create Pool of Claims to Distribute (R5 + R6 candidates)
        const poolIds = [...toMoveFromR1.map(r => r.id), ...toMoveFromR5.map(r => r.id)];

        // Fetch details to sort by ID (proxy for time)
        // Only if we have distinct IDs.
        if (poolIds.length > 0) {
            // 4. Clear their current tickets (Release R1 and R5/R6 slots)
            // R1 movers
            await query("UPDATE az_tickets SET status='AVAILABLE', assigned_claim_id=NULL WHERE id = ANY($1)", [toMoveFromR1.map(t => t.ticket_id)]);
            // R5 movers
            await query("UPDATE az_tickets SET status='AVAILABLE', assigned_claim_id=NULL WHERE id = ANY($1)", [toMoveFromR5.map(t => t.ticket_id)]);
            console.log('Released Tickets for moving claims.');

            // 5. Sort Pool
            const poolDetails = await query("SELECT id, total_qty FROM az_claims WHERE id = ANY($1) ORDER BY id ASC", [poolIds]);
            const sortedClaims = poolDetails.rows;

            console.log(`Total Pool to Redistribute: ${sortedClaims.length}`);

            // 6. Redistribute
            // Fill R5 first
            const r5Slots = await query("SELECT id FROM az_tickets WHERE campaign_id=$1 AND round_number=5 AND status='AVAILABLE' ORDER BY number ASC", [CAMPAIGN_ID]);
            const r5Ids = r5Slots.rows.map(t => t.id);

            // R6 slots
            const r6Slots = await query("SELECT id FROM az_tickets WHERE campaign_id=$1 AND round_number=6 AND status='AVAILABLE' ORDER BY number ASC", [CAMPAIGN_ID]);
            const r6Ids = r6Slots.rows.map(t => t.id);

            let r5Count = 0;
            let r6Count = 0;

            for (const claim of sortedClaims) {
                const qty = claim.total_qty;

                // Try R5
                if (r5Ids.length >= qty) {
                    const tickets = r5Ids.splice(0, qty); // Take tickets

                    // Assign to R5
                    await query("UPDATE az_claims SET round_number=5 WHERE id=$1", [claim.id]);
                    await query("UPDATE az_tickets SET status='ASSIGNED', assigned_claim_id=$1 WHERE id = ANY($2)", [claim.id, tickets]);
                    r5Count++;
                }
                // Try R6
                else if (r6Ids.length >= qty) {
                    const tickets = r6Ids.splice(0, qty);

                    // Assign to R6
                    await query("UPDATE az_claims SET round_number=6 WHERE id=$1", [claim.id]);
                    await query("UPDATE az_tickets SET status='ASSIGNED', assigned_claim_id=$1 WHERE id = ANY($2)", [claim.id, tickets]);
                    r6Count++;
                } else {
                    console.error(`🚨 NO SPACE for Claim ${claim.id} (Qty: ${qty})!`);
                }
            }
            console.log(`Redistribution Result:`);
            console.log(`- Assigned to R5: ${r5Count} claims`);
            console.log(`- Assigned to R6: ${r6Count} claims`);

            // 7. Set Campaign Round
            // If R6 has sales, set to 6. Else 5.
            const currentRound = r6Count > 0 ? 6 : 5;
            await query("UPDATE az_campaigns SET current_round=$1 WHERE id=$2", [currentRound, CAMPAIGN_ID]);
            console.log(`Campaign set to Round ${currentRound}`);
        } else {
            console.log('No claims to move.');
        }

        await query('COMMIT');
        console.log('--- SUCCESS ---');

    } catch (e) {
        await query('ROLLBACK');
        console.error(e);
    }
}
revert();
