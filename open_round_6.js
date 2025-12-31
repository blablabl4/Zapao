const { query } = require('./src/database/db');

async function openRound6() {
    console.log('--- Opening Round 6 ---');
    try {
        // 1. Update Campaign
        const res = await query(`
            UPDATE az_campaigns 
            SET current_round = 6, updated_at = NOW()
            WHERE id = 21
            RETURNING current_round
        `);
        console.log(`Campaign 21 updated. Current Round: ${res.rows[0].current_round}`);

        // 2. Verify Tickets
        const ticketRes = await query(`
            SELECT count(*) 
            FROM az_tickets 
            WHERE round_number = 6 AND status = 'AVAILABLE'
        `);
        console.log(`Available Tickets for Round 6: ${ticketRes.rows[0].count}`);

    } catch (e) {
        console.error('ERROR:', e);
    }
}

openRound6();
