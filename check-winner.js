const { query } = require('./src/database/db');

(async () => {
    try {
        const result = await query(`
            SELECT 
                d.draw_name,
                d.drawn_number,
                d.closed_at,
                d.payout_each,
                o.buyer_ref
            FROM draws d
            JOIN orders o ON o.draw_id = d.id AND o.number = d.drawn_number
            WHERE d.status = 'CLOSED' AND o.status = 'PAID'
            ORDER BY d.closed_at DESC
        `);

        console.log('Total winners found:', result.rows.length);
        result.rows.forEach(r => {
            const parts = (r.buyer_ref || '').split('|');
            console.log(r.draw_name, '#' + r.drawn_number, '-', parts[0], '- R$', r.payout_each);
        });

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
