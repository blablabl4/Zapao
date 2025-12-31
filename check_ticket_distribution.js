const { query } = require('./src/database/db');

async function checkDist() {
    console.log('--- Ticket Distribution by Campaign/Round ---');
    try {
        const sql = `
            SELECT campaign_id, round_number, count(*) as tickets, min(number) as min_num, max(number) as max_num
            FROM az_tickets
            GROUP BY campaign_id, round_number
            ORDER BY campaign_id, round_number
        `;
        const res = await query(sql);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    }
}
checkDist();
