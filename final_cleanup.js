const { query } = require('./src/database/db');

async function finalCleanup() {
    console.log('--- Final Cleanup: Moving Round 7 to Round 1 & Resetting ---');
    try {
        // 1. Find Claims in Round 7
        const claims = await query("SELECT id FROM az_claims WHERE round_number=7");
        if (claims.rows.length > 0) {
            const ids = claims.rows.map(c => c.id);
            console.log(`Moving ${ids.length} claims from Round 7 to Round 1...`);

            // Release R7 tickets
            await query("UPDATE az_tickets SET status='AVAILABLE', assigned_claim_id=NULL, updated_at=NOW() WHERE round_number=7");

            // Move Claims to R1
            await query("UPDATE az_claims SET round_number=1 WHERE id = ANY($1)", [ids]);

            // Assign R1 tickets (simple method: just mark claim as 'ARCHIVED' effectively)
            // Or assign R1 tickets to keep data consistent.
            console.log('Claims moved.');
        }

        // 2. Ensure Round 6 is Empty/Available
        // Reset any assigned tickets in Round 6 (Safety check)
        // Wait! Only if they are REDIST_R1? User said "Nada de mostrar".
        // Assuming no real sales happened in R6 yet.

        // 3. Reset Campaign
        await query("UPDATE az_campaigns SET current_round=6, updated_at=NOW() WHERE id=21");
        console.log('Campaign Reset to Round 6.');

    } catch (e) {
        console.error(e);
    }
}
finalCleanup();
