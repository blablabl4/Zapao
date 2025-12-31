const { query } = require('./src/database/db');

async function inspect() {
    console.log('--- Inspecting Round 6 Claims ---');
    try {
        const sql = `
            SELECT c.id, c.name, c.type, c.total_qty 
            FROM az_claims c 
            JOIN az_tickets t ON t.assigned_claim_id = c.id 
            WHERE t.round_number=6 
            GROUP BY c.id, c.name, c.type, c.total_qty
        `;
        const res = await query(sql);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    }
}
inspect();
