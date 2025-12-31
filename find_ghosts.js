const { query } = require('./src/database/db');

async function findGhosts() {
    console.log('--- Finding Ghost Tickets (Linked but not ASSIGNED) ---');
    try {
        const sql = `
            SELECT t.id, t.number, t.status, t.assigned_claim_id, c.name
            FROM az_tickets t
            JOIN az_claims c ON t.assigned_claim_id = c.id
            WHERE t.campaign_id=21 
            AND t.status != 'ASSIGNED'
        `;
        const res = await query(sql);
        console.table(res.rows);

        if (res.rows.length > 0) {
            console.log(`Found ${res.rows.length} ghost tickets. fixing...`);
            const ids = res.rows.map(r => r.id);
            await query("UPDATE az_tickets SET status='ASSIGNED' WHERE id = ANY($1)", [ids]);
            console.log("Fixed status to ASSIGNED.");
        } else {
            console.log("No ghost tickets found.");
        }

    } catch (e) {
        console.error(e);
    }
}
findGhosts();
