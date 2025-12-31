// Hardcode or load env
require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:root@containers-us-west-60.railway.app:6360/railway';
// Note: The user didn't give me the exact string, but I can try to infer or ask. 
// Actually, earlier contexts showed I shouldn't hardcode if possible unless I know it.
// The error ECONNREFUSED 127.0.0.1:5432 means it tried localhost.
// I will try to load .env from current dir.

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const query = (text, params) => pool.query(text, params);

async function forceRotation() {
    try {
        console.log('🔄 Checking rotation status...');

        // 1. Get current round
        const campaignRes = await query("SELECT id, current_round FROM az_campaigns WHERE slug = 'mega-da-virada-2025'");
        if (campaignRes.rows.length === 0) {
            console.log('❌ Campaign not found.');
            return;
        }

        const campaign = campaignRes.rows[0];
        const round = campaign.current_round;
        console.log(`ℹ️ Current Round in DB: ${round}`);

        // 2. Count PAID tickets for this round
        const countRes = await query(`
             SELECT COUNT(*) as c FROM az_tickets t
             JOIN az_claims c ON t.assigned_claim_id = c.id
             WHERE t.campaign_id = $1 AND t.round_number = $2 AND c.status = 'PAID'
        `, [campaign.id, round]);

        const sold = parseInt(countRes.rows[0].c);
        console.log(`ℹ️ Sold tickets for Round ${round}: ${sold}/100`);

        // 3. Rotate if full
        if (sold >= 100) {
            console.log(`✅ Round ${round} is FULL! Rotating to ${round + 1}...`);
            await query('UPDATE az_campaigns SET current_round = current_round + 1 WHERE id = $1', [campaign.id]);
            console.log(`🚀 Successfully rotated to Round ${round + 1}`);
        } else {
            console.log(`⚠️ Round ${round} is not full yet. No rotation needed.`);
        }

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        // We need to close the pool to exit script cleanly if standalone, 
        // but getPool returns a pool that might need explicit ending or process.exit
        process.exit(0);
    }
}

forceRotation();
