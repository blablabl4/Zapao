const { query, pool } = require('../src/database/db');
require('dotenv').config();

async function findRifa9() {
    try {
        console.log('🔍 Searching for "Rifa 9"...');

        const sql = `
            SELECT 
                id, 
                draw_name, 
                status,
                closed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' as closed_local,
                payout_each, 
                winners_count
            FROM draws 
            WHERE draw_name ILIKE '%Rifa 9%' 
               OR draw_name ILIKE '%Rifa9%'
            ORDER BY id ASC
        `;

        const res = await query(sql);

        if (res.rows.length === 0) {
            console.log('❌ "Rifa 9" NOT FOUND in database.');
        } else {
            console.table(res.rows);
            res.rows.forEach(d => {
                console.log(`Found: #${d.id} "${d.draw_name}" | Date: ${d.closed_local} | Status: ${d.status}`);
            });
        }

        setTimeout(() => process.exit(0), 1000);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

findRifa9();
