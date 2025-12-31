const { query } = require('./src/database/db');

async function checkData() {
    console.log('--- Verifying User Data Integrity (Campaign 21) ---');
    const CAMPAIGN_ID = 21;

    try {
        // 1. Total Assigned Tickets
        const assigned = await query("SELECT count(*) FROM az_tickets WHERE campaign_id=$1 AND status='ASSIGNED'", [CAMPAIGN_ID]);
        const totalSold = parseInt(assigned.rows[0].count);
        console.log(`Total Tickets Sold (Assigned): ${totalSold}`);

        // 2. Tickets missing Claim ID (Orphans in DB structure)
        const missingClaim = await query("SELECT count(*) FROM az_tickets WHERE campaign_id=$1 AND status='ASSIGNED' AND assigned_claim_id IS NULL", [CAMPAIGN_ID]);
        if (parseInt(missingClaim.rows[0].count) > 0) {
            console.error(`❌ CRITICAL: ${missingClaim.rows[0].count} tickets are marked ASSIGNED but have NO USER (No Claim ID)!`);
        } else {
            console.log('✅ All assigned tickets are linked to a User Claim.');
        }

        // 3. Claims with missing Name or Phone
        const incompleteClaims = await query(`
            SELECT c.id, c.name, c.phone, c.status
            FROM az_claims c
            JOIN az_tickets t ON t.assigned_claim_id = c.id
            WHERE t.campaign_id=$1
            AND (c.name IS NULL OR c.name = '' OR c.phone IS NULL OR c.phone = '')
            GROUP BY c.id, c.name, c.phone, c.status
        `, [CAMPAIGN_ID]);

        if (incompleteClaims.rows.length > 0) {
            console.error(`⚠️ WARNING: ${incompleteClaims.rows.length} users have incomplete data (Name or Phone missing):`);
            console.table(incompleteClaims.rows);
        } else {
            console.log('✅ All users have Name and Phone Numbers.');
        }

        // 4. Sample Data
        const sample = await query(`
            SELECT c.name, c.phone, t.round_number, count(t.id) as tickets
            FROM az_claims c
            JOIN az_tickets t ON t.assigned_claim_id = c.id
            WHERE t.campaign_id=$1
            GROUP BY c.name, c.phone, t.round_number
            LIMIT 5
        `, [CAMPAIGN_ID]);
        console.log('\nSample User Data:');
        console.table(sample.rows);

    } catch (e) {
        console.error(e);
    }
}
checkData();
