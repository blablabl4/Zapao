const { query } = require('./src/database/db');

async function findGameWindows() {
    console.log('--- Finding Game Open/Close Windows ---\n');
    try {
        // Get round schema first
        console.log('=== ROUNDS SCHEMA ===');
        const schema = await query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'az_bolao_rounds'
        `);
        console.log('Columns:', schema.rows.map(r => r.column_name).join(', '));

        // Check az_bolao_rounds 
        console.log('\n=== ROUNDS TABLE ===');
        const rounds = await query(`
            SELECT * FROM az_bolao_rounds
            WHERE campaign_id = 21
            ORDER BY round_number
        `);
        console.table(rounds.rows);

        // Get first and last payment for each round
        console.log('\n=== FIRST/LAST PAYMENT PER ROUND (From Claims) ===');
        for (let r = 1; r <= 6; r++) {
            const first = await query(`
                SELECT id, payment_id, name, claimed_at 
                FROM az_claims 
                WHERE campaign_id = 21 AND status = 'PAID' AND round_number = $1
                ORDER BY claimed_at ASC LIMIT 1
            `, [r]);

            const last = await query(`
                SELECT id, payment_id, name, claimed_at 
                FROM az_claims 
                WHERE campaign_id = 21 AND status = 'PAID' AND round_number = $1
                ORDER BY claimed_at DESC LIMIT 1
            `, [r]);

            console.log(`\nJOGO ${r}:`);
            if (first.rows.length > 0) {
                const f = first.rows[0];
                const l = last.rows[0];
                console.log(`  PRIMEIRO: ${new Date(f.claimed_at).toLocaleString('pt-BR')} | ${f.name} | ID: ${f.payment_id}`);
                console.log(`  ÚLTIMO: ${new Date(l.claimed_at).toLocaleString('pt-BR')} | ${l.name} | ID: ${l.payment_id}`);
            } else {
                console.log('  (Sem dados)');
            }
        }

    } catch (e) {
        console.error(e);
    }
}
findGameWindows();
