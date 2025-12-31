const { query } = require('./src/database/db');

async function findFirstR2() {
    console.log('--- First Payment of Round 2 (Jogo 2) ---');
    try {
        const sql = `
            SELECT id, name, phone, claimed_at, round_number
            FROM az_claims
            WHERE campaign_id=21 AND status='PAID' AND round_number=2
            ORDER BY claimed_at ASC
            LIMIT 1
        `;
        const res = await query(sql);
        if (res.rows.length > 0) {
            const r = res.rows[0];
            console.log(`FIRST ROUND 2 PAYMENT:`);
            console.log(`- Name: ${r.name}`);
            console.log(`- Phone: ${r.phone}`);
            console.log(`- Time: ${new Date(r.claimed_at).toLocaleString('pt-BR')}`);
        }
    } catch (e) {
        console.error(e);
    }
}
findFirstR2();
