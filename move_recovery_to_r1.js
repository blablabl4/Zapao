const { query } = require('./src/database/db');

async function moveRecovery() {
    console.log('--- Moving Recovery to Round 1 (Archive) ---');
    try {
        // 1. Identify Recovery Claims
        const claims = await query("SELECT id, total_qty FROM az_claims WHERE type = 'REDIST_R1'");
        const claimIds = claims.rows.map(c => c.id);

        if (claimIds.length === 0) {
            console.log('No recovery claims found.');
            return;
        }
        console.log(`Found ${claimIds.length} recovery claims to move.`);

        // 2. Release current tickets (Rounds 5, 6, 7)
        await query("UPDATE az_tickets SET status='AVAILABLE', assigned_claim_id=NULL, updated_at=NOW() WHERE assigned_claim_id = ANY($1)", [claimIds]);
        console.log('Released tickets from active rounds.');

        // 3. Move Claims to Round 1
        await query("UPDATE az_claims SET round_number=1 WHERE id = ANY($1)", [claimIds]);
        console.log('Updated claims to Round 1.');

        // 4. Assign Round 1 Tickets
        // We need to fetch enough available tickets from Round 1
        // Group by claim to assign correctly? simpler to just assign sequentially?
        // claims.rows has {id, total_qty}

        for (const claim of claims.rows) {
            const needed = claim.total_qty;

            // Get R1 tickets
            const r1Tickets = await query(`
                SELECT id FROM az_tickets 
                WHERE round_number = 1 AND status = 'AVAILABLE' 
                LIMIT $1
            `, [needed]);

            if (r1Tickets.rows.length < needed) {
                console.error(`Not enough R1 tickets for claim ${claim.id} (Needed: ${needed})!`);
                continue;
            }

            const ticketIds = r1Tickets.rows.map(t => t.id);

            // Assign
            await query(`
                UPDATE az_tickets 
                SET status='ASSIGNED', assigned_claim_id=$1, updated_at=NOW()
                WHERE id = ANY($2)
            `, [claim.id, ticketIds]);
        }
        console.log('Re-assigned recovery claims to Round 1 tickets.');

        // 5. Reset Campaign to Round 6
        await query("UPDATE az_campaigns SET current_round=6 WHERE id=21");
        console.log('Campaign reset to Round 6.');

        // 6. Verify Round 6 Status
        const r6 = await query("SELECT status, count(*) FROM az_tickets WHERE round_number=6 GROUP BY status");
        console.table(r6.rows);

    } catch (e) {
        console.error('ERROR:', e);
    }
}

moveRecovery();
