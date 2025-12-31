const { query } = require('./src/database/db');

async function findDiff() {
    console.log('--- Finding the 3 Missing Tickets ---');
    try {
        // Find Claims where total_qty != actual assigned count
        const sql = `
            SELECT c.id, c.name, c.total_qty, count(t.id) as assigned_count
            FROM az_claims c 
            LEFT JOIN az_tickets t ON t.assigned_claim_id = c.id
            WHERE c.campaign_id=21 AND c.status='PAID'
            GROUP BY c.id
            HAVING count(t.id) < c.total_qty
        `;
        const res = await query(sql);
        console.table(res.rows);

        if (res.rows.length === 0) {
            console.log("No partial claims found. Maybe pure orphans?");
            const orphans = await query(`
                SELECT c.id, c.name, c.total_qty 
                FROM az_claims c 
                LEFT JOIN az_tickets t ON t.assigned_claim_id = c.id
                WHERE c.campaign_id=21 AND c.status='PAID' AND t.id IS NULL
             `);
            console.table(orphans.rows);
        }

    } catch (e) {
        console.error(e);
    }
}
findDiff();
