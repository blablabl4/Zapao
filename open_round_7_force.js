const { query } = require('./src/database/db');

async function openRound7() {
    console.log('--- Opening Round 7 (Force) ---');
    const CAMPAIGN_ID = 21;
    const ROUND = 7;
    const START_NUM = 1; // Assuming 1-100 for each round? 
    // Wait, the system seems to use 1-100 recycled numbers for each round?
    // Let's check az_tickets structure for other rounds.
    // Assuming yes based on user context "100 cotas".

    try {
        // 1. Update Campaign
        await query("UPDATE az_campaigns SET current_round = $1 WHERE id = $2", [ROUND, CAMPAIGN_ID]);
        console.log(`Campaign set to Round ${ROUND}`);

        // 2. Generate Tickets (1 to 100)
        // Check if exist first
        const check = await query("SELECT count(*) FROM az_tickets WHERE campaign_id=$1 AND round_number=$2", [CAMPAIGN_ID, ROUND]);
        const count = parseInt(check.rows[0].count);

        if (count < 100) {
            console.log(`Found only ${count} tickets. Generating...`);
            const values = [];
            for (let i = 1; i <= 100; i++) {
                values.push(`(${CAMPAIGN_ID}, ${i}, ${ROUND}, 'AVAILABLE')`);
            }

            // Insert in batches if needed, but 100 is small
            const sql = `
                INSERT INTO az_tickets (campaign_id, number, round_number, status)
                VALUES ${values.join(',')}
                ON CONFLICT (campaign_id, number, round_number) DO NOTHING
            `;
            await query(sql);
            console.log('Tickets inserted.');
        } else {
            console.log(`Tickets already exist (${count}).`);
        }

    } catch (e) {
        console.error('ERROR:', e);
    }
}

openRound7();
