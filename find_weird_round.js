const { query } = require('./src/database/db');

async function findWeird() {
    console.log('--- Finding Tickets in Weird Rounds ---');
    try {
        const sql = `
            SELECT id, number, round_number, status, assigned_claim_id
            FROM az_tickets 
            WHERE campaign_id=21 
            AND status='ASSIGNED' 
            AND round_number NOT IN (1, 2, 3, 4, 5, 6)
        `;
        const res = await query(sql);
        console.table(res.rows);

        if (res.rows.length === 0) {
            console.log("No weird rounds found. Maybe round 7?");
            const r7 = await query("SELECT count(*) FROM az_tickets WHERE campaign_id=21 AND round_number=7 AND status='ASSIGNED'");
            console.log(`Round 7 Assigned: ${r7.rows[0].count}`);
        }

    } catch (e) {
        console.error(e);
    }
}
findWeird();
