const { query } = require('./src/database/db');

async function countRounds() {
    console.log('--- Counting Sales per Round ---');
    try {
        const res = await query(`
            SELECT round_number, count(*) as count, sum(total_qty) as tickets
            FROM az_claims
            WHERE type = 'BOLAO' AND status = 'PAID'
            GROUP BY round_number
            ORDER BY round_number
        `);

        if (res.rows.length === 0) {
            console.log('No PAID sales found.');
        } else {
            console.table(res.rows);
        }

    } catch (e) {
        console.error('ERROR:', e);
    }
}

countRounds();
