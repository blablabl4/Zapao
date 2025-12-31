const { query } = require('./src/database/db');

async function findFirst() {
    console.log('--- Finding First Payment (Campaign 21) ---');
    try {
        const sql = `
            SELECT id, name, phone, total_qty, claimed_at, round_number
            FROM az_claims
            WHERE campaign_id=21 AND status='PAID'
            ORDER BY claimed_at ASC
            LIMIT 5
        `;
        const res = await query(sql);
        res.rows.forEach(r => {
            console.log(`[${r.id}] ${r.name} | Qty: ${r.total_qty} | Time: ${new Date(r.claimed_at).toLocaleString('pt-BR')} | Round: ${r.round_number}`);
        });

    } catch (e) {
        console.error(e);
    }
}
findFirst();
