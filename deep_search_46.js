const { query } = require('./src/database/db');

async function deepSearch46() {
    try {
        console.log('--- DB TIMEZONE CHECK ---');
        const timeRes = await query(`SELECT NOW()::text as db_time, current_setting('TIMEZONE') as tz`);
        console.log(`DB Time: ${timeRes.rows[0].db_time}`);
        console.log(`DB Zone: ${timeRes.rows[0].tz}`);

        console.log('\n--- SEARCHING ORDERS #46 (22:00-23:30 Local) ---');
        // 22:00 Jan 2 Local (-3) = 01:00 Jan 3 UTC
        // 23:30 Jan 2 Local (-3) = 02:30 Jan 3 UTC

        const startUTC = '2026-01-03 01:00:00';
        const endUTC = '2026-01-03 02:30:00';

        const res = await query(`
            SELECT order_id, buyer_ref, status, created_at, number
            FROM orders 
            WHERE number = 46
              AND created_at >= $1
              AND created_at <= $2
        `, [startUTC, endUTC]);

        if (res.rows.length === 0) {
            console.log('RESULT: NO MATCHES found in this window.');
        } else {
            console.log(`RESULT: Found ${res.rows.length} matches!`);
            res.rows.forEach(r => {
                console.log(`- [${r.status}] ${r.buyer_ref.split('|')[0]} @ ${r.created_at}`);
            });
        }

        console.log('\n--- CLOSEST ORDERS TO WINDOW ---');
        const close = await query(`
            SELECT buyer_ref, created_at 
            FROM orders 
            WHERE number = 46 
            ORDER BY ABS(EXTRACT(EPOCH FROM (created_at - TIMESTAMP '2026-01-03 01:45:00'))) ASC
            LIMIT 3
        `);
        close.rows.forEach(r => {
            console.log(`- ${r.created_at} : ${r.buyer_ref.split('|')[0]}`);
        });

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

deepSearch46();
