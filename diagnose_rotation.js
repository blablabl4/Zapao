require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const query = (text, params) => pool.query(text, params);

async function diagnose() {
    try {
        console.log('🔍 Diagnosing Round Rotation...');

        // 1. Get Campaign
        const campRes = await query("SELECT id, current_round, max_rounds FROM az_campaigns WHERE slug = 'mega-da-virada-2025'");
        if (campRes.rows.length === 0) {
            console.log('❌ Campaign not found!');
            return;
        }
        const campaign = campRes.rows[0];
        console.log('Campaign:', campaign);

        const r = campaign.current_round;

        // 2. Count Claims for this round
        const claimsRes = await query(`
            SELECT status, count(*) 
            FROM az_claims 
            WHERE campaign_id = $1 AND round_number = $2 AND type = 'BOLAO'
            GROUP BY status
        `, [campaign.id, r]);
        console.log(`\n📊 Claims for Round ${r}:`);
        console.table(claimsRes.rows);

        // 3. Count Tickets linked to PAID claims
        // The rotation logic depends on THIS specific query:
        const countRes = await query(`
             SELECT COUNT(*) as c FROM az_tickets t
             JOIN az_claims c ON t.assigned_claim_id = c.id
             WHERE t.campaign_id = $1 AND t.round_number = $2 AND c.status = 'PAID'
        `, [campaign.id, r]);

        const sold = parseInt(countRes.rows[0].c);
        console.log(`\n🎟️ SOLD Tickets Count (via Join): ${sold}/100`);

        if (sold >= 100) {
            console.log('✅ CONDITION MET: Should rotate!');
        } else {
            console.log(`❌ CONDITION NOT MET: ${sold} < 100`);

            // Debug: Why? Maybe claims are paid but tickets not linked?
            const totalPaidClaimsQty = await query(`
                SELECT sum(total_qty) as total 
                FROM az_claims 
                WHERE campaign_id = $1 AND round_number = $2 AND status = 'PAID'
            `, [campaign.id, r]);
            console.log(`Debug - Total Qty on PAID Claims: ${totalPaidClaimsQty.rows[0].total}`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

diagnose();
