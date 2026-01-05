const { query, pool } = require('../src/database/db');
require('dotenv').config();

async function debugPrizes() {
    try {
        console.log('🔍 FULL DUMP of Jan 3rd 2026 Draws...');

        const sql = `
            SELECT 
                id, 
                draw_name, 
                status,
                closed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' as closed_local,
                payout_each, 
                winners_count
            FROM draws 
            WHERE date(closed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = '2026-01-03'
            ORDER BY id ASC
        `;

        const res = await query(sql);
        let total = 0;

        console.log('ID | NAME | STATUS | WINNERS | PAYOUT | TOTAL');
        res.rows.forEach(d => {
            const sub = parseFloat(d.payout_each) * d.winners_count;
            total += sub;
            console.log(`#${d.id} | ${d.draw_name} | ${d.status} | ${d.winners_count} | ${d.payout_each} | ${sub}`);
        });

        console.log('------------------------');
        console.log(`GRAND TOTAL: R$ ${total}`);

        setTimeout(() => process.exit(0), 1000);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

debugPrizes();
