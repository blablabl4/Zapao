const { query } = require('./src/database/db');

async function deepVerify() {
    console.log('--- DEEP VERIFICATION: Orphan IDs vs Database ---');

    // Sample of orphan IDs from the report (R$20 ones from 14:30-14:41)
    const sampleOrphans = [
        '139412630673', '140059972842', '139409264031', '140058131128', '139410505139'
    ];

    try {
        console.log('Checking if these payment IDs exist ANYWHERE in az_claims...\n');

        for (const pid of sampleOrphans) {
            // Try exact match
            const exact = await query('SELECT id, name, status, campaign_id FROM az_claims WHERE payment_id = $1', [pid]);

            // Try partial match (in case stored differently)
            const partial = await query('SELECT id, name, status, campaign_id, payment_id FROM az_claims WHERE payment_id LIKE $1', [`%${pid.slice(-8)}%`]);

            if (exact.rows.length > 0) {
                console.log(`[${pid}] FOUND (Exact): ID ${exact.rows[0].id} - ${exact.rows[0].name} (Campaign ${exact.rows[0].campaign_id})`);
            } else if (partial.rows.length > 0) {
                console.log(`[${pid}] FOUND (Partial): ID ${partial.rows[0].id} - ${partial.rows[0].name} | Stored as: ${partial.rows[0].payment_id}`);
            } else {
                console.log(`[${pid}] NOT FOUND in database!`);
            }
        }

        // Also check: How many PAID claims have payment_id set vs null?
        const withPID = await query("SELECT count(*) FROM az_claims WHERE campaign_id=21 AND status='PAID' AND payment_id IS NOT NULL");
        const withoutPID = await query("SELECT count(*) FROM az_claims WHERE campaign_id=21 AND status='PAID' AND payment_id IS NULL");

        console.log(`\n--- PAYMENT ID COVERAGE ---`);
        console.log(`Claims WITH payment_id: ${withPID.rows[0].count}`);
        console.log(`Claims WITHOUT payment_id: ${withoutPID.rows[0].count}`);

    } catch (e) {
        console.error(e);
    }
}
deepVerify();
