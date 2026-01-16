const { query } = require('../src/database/db');
const DrawService = require('../src/services/DrawService');

async function checkHistory() {
    try {
        console.log('--- Checking Global Winners History ---');
        const history = await DrawService.getAllWinners();
        console.log(`Found ${history.length} winners.`);
        console.log(JSON.stringify(history, null, 2));

        // Dig deeper if empty
        if (history.length === 0) {
            console.log('--- DEBUGGING QUERY ---');
            const res = await query(`
                SELECT d.id, d.draw_name, d.status, d.drawn_number 
                FROM draws d 
                WHERE d.status = 'CLOSED' 
                ORDER BY d.closed_at DESC LIMIT 5
            `);
            console.log('Closed Draws:', res.rows);

            if (res.rows.length > 0) {
                const draw = res.rows[0];
                console.log(`Checking Orders for Draw #${draw.id} with number ${draw.drawn_number}...`);
                const orders = await query(`
                    SELECT order_id, status, number 
                    FROM orders 
                    WHERE draw_id = $1 AND number = $2
                `, [draw.id, draw.drawn_number]);
                console.log('Winning Orders:', orders.rows);
            }
        }

    } catch (e) {
        console.error('Error:', e);
    }
    process.exit(0);
}

checkHistory();
