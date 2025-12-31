const { query } = require('./src/database/db');

async function openRound5() {
    console.log('--- Opening Round 5 ---');
    try {
        // 1. Update Campaign to Round 5
        await query(`UPDATE az_campaigns SET current_round = 5 WHERE id = 21`);
        console.log('✅ Campaign updated to Round 5');

        // 2. Verify Orphans (Round 5)
        const res = await query(`SELECT number, status FROM az_tickets WHERE round_number = 5 AND status = 'ASSIGNED' ORDER BY number`);
        console.log(`\n🎫 Status Jogo 5 (${res.rows.length} tickets já vendidos/atribuídos):`);
        res.rows.forEach(r => console.log(`   #${r.number}: ${r.status}`));

    } catch (e) {
        console.error('Error:', e.message);
    }
}

openRound5();
