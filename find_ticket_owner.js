const { query } = require('./src/database/db');

async function findOwner() {
    try {
        const sql = `
            SELECT c.name, c.phone, c.status, t.number, t.round_number
            FROM az_tickets t
            JOIN az_claims c ON t.assigned_claim_id = c.id
            WHERE t.round_number = 4 AND t.number = 34
        `;
        const res = await query(sql);
        if (res.rows.length > 0) {
            console.log('FOUND:', res.rows[0]);
        } else {
            console.log('Ticket not found or not sold.');
        }
    } catch (e) {
        console.error(e);
    }
}

findOwner();
