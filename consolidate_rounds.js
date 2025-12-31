const { query } = require('./src/database/db');

async function consolidate() {
    console.log('--- Consolidating Rounds (Safety First) ---');
    const CAMPAIGN_ID = 21;

    try {
        await query('BEGIN'); // Transaction start

        // 1. Expand Round 1 to 200 Tickets (Campaign 21)
        console.log('1. Expanding Round 1 to 200 tickets...');
        const values = [];
        for (let i = 101; i <= 200; i++) {
            values.push(`(${CAMPAIGN_ID}, ${i}, 1, 'AVAILABLE')`);
        }
        const insertSql = `
            INSERT INTO az_tickets (campaign_id, number, round_number, status)
            VALUES ${values.join(',')}
            ON CONFLICT (campaign_id, number, round_number) DO NOTHING
        `;
        await query(insertSql);
        console.log('   -> Done.');

        // 2. Move Round 5 Sales -> Round 1 (Offset +100)
        console.log('2. Moving Round 5 Sales -> Round 1 (Offset +100)...');

        // Find R5 active claims
        const r5Claims = await query("SELECT id, total_qty FROM az_claims WHERE campaign_id=$1 AND round_number=5", [CAMPAIGN_ID]);
        const r5ClaimIds = r5Claims.rows.map(c => c.id);

        if (r5ClaimIds.length > 0) {
            // Get their current tickets in R5
            const r5Tickets = await query(`
                SELECT id, number, assigned_claim_id 
                FROM az_tickets 
                WHERE campaign_id=$1 AND round_number=5 AND assigned_claim_id = ANY($2)
            `, [CAMPAIGN_ID, r5ClaimIds]);

            // Map: ClaimID -> List of TicketNumbers
            const claimTickets = {};
            r5Tickets.rows.forEach(t => {
                if (!claimTickets[t.assigned_claim_id]) claimTickets[t.assigned_claim_id] = [];
                claimTickets[t.assigned_claim_id].push(t.number);
            });

            // RELEASE R5 Tickets
            await query("UPDATE az_tickets SET status='AVAILABLE', assigned_claim_id=NULL WHERE round_number=5 AND campaign_id=$1", [CAMPAIGN_ID]);
            console.log('   -> R5 Tickets Released.');

            // Move Claims to R1
            await query("UPDATE az_claims SET round_number=1 WHERE id = ANY($1)", [r5ClaimIds]);

            // ACCUPY R1 Tickets (Offset +100)
            for (const [claimId, numbers] of Object.entries(claimTickets)) {
                const newNumbers = numbers.map(n => n + 100);

                // Assign specifically these numbers in R1
                await query(`
                    UPDATE az_tickets 
                    SET status='ASSIGNED', assigned_claim_id=$1, updated_at=NOW()
                    WHERE campaign_id=$2 AND round_number=1 AND number = ANY($3)
                `, [claimId, CAMPAIGN_ID, newNumbers]);
            }
            console.log(`   -> Moved ${r5ClaimIds.length} claims to R1 (101-200).`);
        } else {
            console.log('   -> No R5 claims to move.');
        }

        // 3. Move Round 6 Sales -> Round 5 (Same Numbers)
        console.log('3. Moving Round 6 Sales -> Round 5 (Direct)...');

        const r6Claims = await query("SELECT id, total_qty FROM az_claims WHERE campaign_id=$1 AND round_number=6", [CAMPAIGN_ID]);
        const r6ClaimIds = r6Claims.rows.map(c => c.id);

        if (r6ClaimIds.length > 0) {
            // Get their current tickets in R6
            const r6Tickets = await query(`
                SELECT id, number, assigned_claim_id 
                FROM az_tickets 
                WHERE campaign_id=$1 AND round_number=6 AND assigned_claim_id = ANY($2)
            `, [CAMPAIGN_ID, r6ClaimIds]);

            const claimTicketsR6 = {};
            r6Tickets.rows.forEach(t => {
                if (!claimTicketsR6[t.assigned_claim_id]) claimTicketsR6[t.assigned_claim_id] = [];
                claimTicketsR6[t.assigned_claim_id].push(t.number);
            });

            // RELEASE R6 Tickets
            await query("UPDATE az_tickets SET status='AVAILABLE', assigned_claim_id=NULL WHERE round_number=6 AND campaign_id=$1", [CAMPAIGN_ID]);
            console.log('   -> R6 Tickets Released.');

            // Move Claims to R5
            await query("UPDATE az_claims SET round_number=5 WHERE id = ANY($1)", [r6ClaimIds]);

            // OCCUPY R5 Tickets (Original Numbers)
            for (const [claimId, numbers] of Object.entries(claimTicketsR6)) {
                // Assign specifically these numbers in R5
                await query(`
                     UPDATE az_tickets 
                     SET status='ASSIGNED', assigned_claim_id=$1, updated_at=NOW()
                     WHERE campaign_id=$2 AND round_number=5 AND number = ANY($3)
                 `, [claimId, CAMPAIGN_ID, numbers]);
            }
            console.log(`   -> Moved ${r6ClaimIds.length} claims to R5.`);
        } else {
            console.log('   -> No R6 claims to move.');
        }

        // 4. Update Campaign -> 5
        await query("UPDATE az_campaigns SET current_round=5 WHERE id=$1", [CAMPAIGN_ID]);
        console.log('4. Campaign Reset to Round 5.');

        await query('COMMIT');
        console.log('--- SUCCESS ---');

    } catch (e) {
        await query('ROLLBACK');
        console.error('ERROR (Rolled Back):', e);
    }
}
consolidate();
