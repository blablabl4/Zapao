const { query } = require('./src/database/db');

async function forceRound6() {
    console.log('--- Force Populating Round 6 ---');
    const CAMPAIGN_ID = 21;
    const ROUND = 6;

    try {
        // 1. Ensure Campaign is set to Round 6
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
            
            // Insert
            const sql = `
                INSERT INTO az_tickets (campaign_id, number, round_number, status)
                VALUES ${values.join(',')}
                ON CONFLICT (campaign_id, number, round_number) DO NOTHING
            `;
            await query(sql);
            console.log('✅ Tickets for Round 6 inserted successfully.');
        } else {
            console.log(`✅ Tickets already exist for Round 6 (${count}).`);
        }

    } catch (e) {
        console.error('ERROR:', e);
    }
}

forceRound6();
