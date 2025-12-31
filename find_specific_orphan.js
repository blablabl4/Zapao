const { query } = require('./src/database/db');

async function findSpecificOrphan() {
    console.log('--- Pinpointing the Missing Claim ---');
    try {
        // 1. Get IDs of all PAID claims
        const paid = await query("SELECT id FROM az_claims WHERE campaign_id=21 AND status='PAID' ORDER BY id");
        const paidIds = paid.rows.map(r => r.id);
        console.log(`Total Paid Claims: ${paidIds.length}`);

        // 2. Get IDs of claims that have assigned tickets
        const assigned = await query("SELECT DISTINCT assigned_claim_id FROM az_tickets WHERE campaign_id=21 AND status='ASSIGNED' AND assigned_claim_id IS NOT NULL ORDER BY assigned_claim_id");
        const assignedIds = assigned.rows.map(r => r.assigned_claim_id);
        console.log(`Claims with Tickets: ${assignedIds.length}`);

        // 3. Find Difference (Paid but No Tickets)
        const orphans = paidIds.filter(id => !assignedIds.includes(id));
        console.log(`Orphan Claim IDs: ${orphans.join(', ')}`);

        if (orphans.length > 0) {
            console.log("Fetching details for orphans...");
            const details = await query("SELECT * FROM az_claims WHERE id = ANY($1)", [orphans]);
            console.table(details.rows);

            // Attempt AUTO-FIX (Assign to Round 6)
            console.log("Attempting to assign these orphans to Round 6...");
            const orphanClaim = details.rows[0];
            const needed = orphanClaim.total_qty;

            // Get available tickets in R6
            const r6 = await query("SELECT id FROM az_tickets WHERE campaign_id=21 AND round_number=6 AND status='AVAILABLE' ORDER BY number ASC LIMIT $1", [needed]);

            if (r6.rows.length === needed) {
                const tIds = r6.rows.map(r => r.id);
                // Update Claim Round
                await query("UPDATE az_claims SET round_number=6 WHERE id=$1", [orphanClaim.id]);
                // Assign Tickets
                await query("UPDATE az_tickets SET status='ASSIGNED', assigned_claim_id=$1 WHERE id = ANY($2)", [orphanClaim.id, tIds]);
                console.log(`✅ FIXED: Assigned Claim ${orphanClaim.id} to ${needed} tickets in Round 6.`);
            } else {
                console.error("❌ Not enough space in Round 6 to auto-fix.");
            }
        }

    } catch (e) {
        console.error(e);
    }
}
findSpecificOrphan();
