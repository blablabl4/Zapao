const { query } = require('./src/database/db');

async function check47() {
    try {
        console.log('Checking number 47...');

        // Get current draw first
        const drawRes = await query(`SELECT * FROM draws WHERE status IN ('ACTIVE', 'SCHEDULED') ORDER BY created_at DESC LIMIT 1`);
        const currentDraw = drawRes.rows[0];

        if (!currentDraw) {
            console.log('No active draw found.');
        } else {
            console.log(`Current Draw: ${currentDraw.draw_name} (ID: ${currentDraw.id})`);

            const res = await query(`
                SELECT o.number, o.status, o.buyer_ref, o.draw_id, d.draw_name
                FROM orders o
                JOIN draws d ON o.draw_id = d.id
                WHERE o.buyer_ref ILIKE '%Leidivan%'
                ORDER BY o.created_at DESC
            `);

            const res2 = await query(`
                SELECT count(*) as count, string_agg(split_part(buyer_ref, '|', 1), ', ') as names
                FROM orders o
                JOIN draws d ON o.draw_id = d.id
                WHERE o.number = 47 
                  AND o.status = 'PAID'
                  AND d.draw_name = 'primeira rifa'
            `);

            console.log(JSON.stringify(res2.rows[0], null, 2));
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check47();
