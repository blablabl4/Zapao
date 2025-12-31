const { query } = require('./src/database/db');

async function checkCounts() {
    console.log('--- Ticket Counts: Round 1 & Round 5 ---');
    try {
        const sql = `
            SELECT round_number, status, count(*) 
            FROM az_tickets 
            WHERE round_number IN (1, 5, 6) AND campaign_id = 21
            GROUP BY round_number, status 
            ORDER BY round_number, status
        `;
        const res = await query(sql);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    }
}
checkCounts();
