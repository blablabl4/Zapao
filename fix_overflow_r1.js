const { query } = require('./src/database/db');

async function fixOverflow() {
    console.log('--- Fixing Round 1 Overflow (Strict 100 Limit) ---');
    const CAMPAIGN_ID = 21;

    try {
        await query('BEGIN');

        // 1. Get current Assigned > 100 in R1
        const overflowClaims = await query(`
            SELECT t.id as ticket_id, t.number, t.assigned_claim_id, c.name
            FROM az_tickets t
            JOIN az_claims c ON t.assigned_claim_id = c.id
            WHERE t.campaign_id=$1 AND t.round_number=1 AND t.number > 100 AND t.status='ASSIGNED'
            ORDER BY t.number ASC
        `, [CAMPAIGN_ID]);

        console.log(`Found ${overflowClaims.rows.length} overflow tickets (>100) in R1.`);

        // 2. Find Free Spots in R1 (1-100)
        // We expect (100 - 37) = 63 free spots approximately.
        const r1Free = await query(`
            SELECT number FROM az_tickets 
            WHERE campaign_id=$1 AND round_number=1 AND number <= 100 AND status='AVAILABLE'
            ORDER BY number ASC
        `, [CAMPAIGN_ID]);

        const freeSlotsR1 = r1Free.rows.map(r => r.number);
        console.log(`Found ${freeSlotsR1.length} free slots in R1 (<=100).`);

        // 3. Find Free Spots in R5 (1-100)
        // R5 currently holds "Old R6" (20 claims). So ~80 free.
        const r5Free = await query(`
            SELECT number FROM az_tickets 
            WHERE campaign_id=$1 AND round_number=5 AND status='AVAILABLE'
            ORDER BY number ASC
        `, [CAMPAIGN_ID]);

        const freeSlotsR5 = r5Free.rows.map(r => r.number);
        console.log(`Found ${freeSlotsR5.length} free slots in R5.`);

        // 4. Distribute Overflow
        const toStayInR1 = []; // Will be renumbered to freeSlotsR1
        const toMoveToR5 = []; // Will be moved to R5 and renumbered to freeSlotsR5

        for (const ticket of overflowClaims.rows) {
            if (freeSlotsR1.length > 0) {
                const newNum = freeSlotsR1.shift(); // Take first available
                toStayInR1.push({ ticket_id: ticket.ticket_id, new_number: newNum });
            } else {
                if (freeSlotsR5.length > 0) {
                    const newNum = freeSlotsR5.shift();
                    toMoveToR5.push({
                        claim_id: ticket.assigned_claim_id, // Need claim ID to assign new ticket
                        old_ticket_id: ticket.ticket_id,
                        new_number: newNum
                    });
                } else {
                    throw new Error("No space in R5 either! Critical Full.");
                }
            }
        }

        console.log(`Plan: Stay in R1: ${toStayInR1.length}, Move to R5: ${toMoveToR5.length}`);

        // 5. Execute Moves

        // A. Renumber inside R1 (Stay)
        // Note: We can't update 'number' directly if it conflicts, but we are updating TO 'AVAILABLE' numbers so it's safe.
        // We are updating the EXISTING ticket record (id > 100) to behave like the available one?
        // NO, we should release the >100 ticket and OCCUPY the <100 ticket to keep IDs clean?
        // Actually, the illegal tickets (id > 100) will be deleted.
        // So we should UPDATE the <100 ticket to be ASSIGNED to the claim.

        for (const item of toStayInR1) {
            // 1. Release the illegal ticket (will be deleted later, but clear assign for now)
            await query("UPDATE az_tickets SET status='AVAILABLE', assigned_claim_id=NULL WHERE id=$1", [item.ticket_id]);

            // 2. Assign the Claim to the valid R1 ticket (by Number)
            // We need to fetch the ID of the ticket with 'new_number' in R1.
            // Or update by number directly.
            // We already know the number is valid and available (from step 2).
            // But we need the Claim ID.
            const claimId = overflowClaims.rows.find(r => r.ticket_id === item.ticket_id).assigned_claim_id;

            await query(`
                UPDATE az_tickets 
                SET status='ASSIGNED', assigned_claim_id=$1, updated_at=NOW()
                WHERE campaign_id=$2 AND round_number=1 AND number=$3
             `, [claimId, CAMPAIGN_ID, item.new_number]);
        }
        console.log('   -> R1 Packing Complete.');

        // B. Move to R5
        for (const item of toMoveToR5) {
            // 1. Release illegal ticket
            await query("UPDATE az_tickets SET status='AVAILABLE', assigned_claim_id=NULL WHERE id=$1", [item.old_ticket_id]);

            // 2. Update Claim -> Round 5
            await query("UPDATE az_claims SET round_number=5 WHERE id=$1", [item.claim_id]);

            // 3. Assign the Claim to valid R5 ticket
            await query(`
                UPDATE az_tickets 
                SET status='ASSIGNED', assigned_claim_id=$1, updated_at=NOW()
                WHERE campaign_id=$2 AND round_number=5 AND number=$3
             `, [item.claim_id, CAMPAIGN_ID, item.new_number]);
        }
        console.log('   -> R5 Spillover Complete.');

        // 6. Delete Illegal Tickets (>100)
        await query("DELETE FROM az_tickets WHERE campaign_id=$1 AND round_number=1 AND number > 100", [CAMPAIGN_ID]);
        console.log('6. Illegal tickets (>100) deleted.');

        await query('COMMIT');
        console.log('--- SUCCESS: Balanced ---');

    } catch (e) {
        await query('ROLLBACK');
        console.error(e);
    }
}
fixOverflow();
