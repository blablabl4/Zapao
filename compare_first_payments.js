const { query } = require('./src/database/db');

async function compareFirsts() {
    console.log('--- First Payment of EACH Round (Timezone Check) ---');
    try {
        for (let round = 1; round <= 6; round++) {
            const sql = `
                SELECT id, name, claimed_at, round_number
                FROM az_claims
                WHERE campaign_id=21 AND status='PAID' AND round_number=$1
                ORDER BY claimed_at ASC
                LIMIT 1
            `;
            const res = await query(sql, [round]);
            if (res.rows.length > 0) {
                const r = res.rows[0];
                const localTime = new Date(r.claimed_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
                const utcTime = new Date(r.claimed_at).toISOString();
                console.log(`ROUND ${round}: ${r.name}`);
                console.log(`  - Local (SP): ${localTime}`);
                console.log(`  - UTC: ${utcTime}`);
                console.log('');
            } else {
                console.log(`ROUND ${round}: No payments found.`);
            }
        }
    } catch (e) {
        console.error(e);
    }
}
compareFirsts();
