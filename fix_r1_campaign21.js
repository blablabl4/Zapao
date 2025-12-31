const { query } = require('./src/database/db');

async function fixR1() {
    console.log('--- Fixing Round 1 for Campaign 21 (Bolão) ---');
    const CAMPAIGN_ID = 21;
    const ROUND = 1;

    try {
        // 1. Generate 100 Tickets for C21 / R1
        const check = await query("SELECT count(*) FROM az_tickets WHERE campaign_id=$1 AND round_number=$2", [CAMPAIGN_ID, ROUND]);
        const count = parseInt(check.rows[0].count);

        if (count < 100) {
            console.log(`Generating 100 tickets for Campaign ${CAMPAIGN_ID} Round ${ROUND}...`);
            const values = [];
            for (let i = 1; i <= 100; i++) {
                values.push(`(${CAMPAIGN_ID}, ${i}, ${ROUND}, 'AVAILABLE')`);
            }
            const sql = `
                INSERT INTO az_tickets (campaign_id, number, round_number, status)
                VALUES ${values.join(',')}
                ON CONFLICT (campaign_id, number, round_number) DO NOTHING
            `;
            await query(sql);
            console.log('Tickets generated.');
        } else {
            console.log('Tickets already exist.');
        }

        // 2. Find Recovered Claims (The ones we moved to Round 1 previously)
        // They are in az_claims with round_number=1 (we moved them there).
        // But they are likely assigned to WRONG tickets (Campaign 1).

        // Let's release the old Campaign 1 tickets first
        // We find claims in C21 R1 (orphans were created with C21)
        const claims = await query("SELECT id, total_qty FROM az_claims WHERE campaign_id=$1 AND round_number=$2", [CAMPAIGN_ID, ROUND]);
        const claimIds = claims.rows.map(c => c.id);

        if (claimIds.length > 0) {
            console.log(`Found ${claimIds.length} claims in C21 / R1. Re-linking to correct tickets...`);

            // Release whatever tickes they hold now (likely Campaign 1 tickets)
            await query("UPDATE az_tickets SET status='AVAILABLE', assigned_claim_id=NULL WHERE assigned_claim_id = ANY($1)", [claimIds]);
            console.log('Released incorrect tickets.');

            // Now assign to the NEW C21/R1 tickets
            // Iterate claims and grab tickets
            for (const claim of claims.rows) {
                const needed = claim.total_qty;
                const newTickets = await query(`
                    SELECT id FROM az_tickets 
                    WHERE campaign_id=$1 AND round_number=$2 AND status='AVAILABLE'
                    ORDER BY number ASC
                    LIMIT $3
                `, [CAMPAIGN_ID, ROUND, needed]);

                if (newTickets.rows.length < needed) {
                    console.log(`Not enough new tickets for claim ${claim.id}`);
                    continue;
                }

                const tIds = newTickets.rows.map(t => t.id);
                await query(`
                    UPDATE az_tickets 
                    SET status='ASSIGNED', assigned_claim_id=$1, updated_at=NOW()
                    WHERE id = ANY($2)
                `, [claim.id, tIds]);
            }
            console.log('Claims successfully re-linked to Campaign 21 tickets.');
        }

        // 3. Final Stats for C21 / R1
        const finalCheck = await query("SELECT status, count(*) FROM az_tickets WHERE campaign_id=$1 AND round_number=$2 GROUP BY status", [CAMPAIGN_ID, ROUND]);
        console.table(finalCheck.rows);

    } catch (e) {
        console.error(e);
    }
}
fixR1();
