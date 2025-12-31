const { query } = require('./src/database/db');

async function findBroad() {
    const term = '%139445586859%';
    console.log(`Searching broad for: ${term}`);

    try {
        const sql = `
            SELECT c.id, c.name, c.phone, c.payment_id, c.status, t.number, t.round_number
            FROM az_claims c
            LEFT JOIN az_tickets t ON c.id = t.assigned_claim_id
            WHERE c.payment_id::text LIKE $1 OR c.phone LIKE $1
        `;
        const res = await query(sql, [term]);

        if (res.rows.length > 0) {
            console.log('FOUND ' + res.rows.length + ' records:');
            res.rows.forEach(r => console.log(r));
        } else {
            console.log('No records found even with broad search.');
        }
    } catch (e) {
        console.error(e);
    }
}

findBroad();
