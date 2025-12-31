const { query } = require('./src/database/db');

async function checkRounds() {
    console.log('--- Checking Rounds 1 to 5 Status ---');
    try {
        const sql = `
            SELECT round_number, status, count(*) 
            FROM az_tickets 
            WHERE round_number BETWEEN 1 AND 5 
            GROUP BY round_number, status 
            ORDER BY round_number, status
        `;
        const res = await query(sql);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    }
}
checkRounds();
