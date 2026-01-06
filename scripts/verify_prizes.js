const { query } = require('../src/database/db');

async function verifyPrizePayouts() {
    try {
        // Check if there's a payouts or transactions table
        const tables = await query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('=== TABELAS NO BANCO ===');
        tables.rows.forEach(t => console.log(' -', t.table_name));

        // Check draws with more details
        console.log('\n=== DETALHES DAS RIFAS (prize_base vs payout_each) ===\n');
        const draws = await query(`
            SELECT id, draw_name, prize_base, payout_each, winners_count, drawn_number
            FROM draws 
            WHERE status = 'CLOSED' AND drawn_number IS NOT NULL
            ORDER BY id
        `);

        let totalPrizeBase = 0;
        let totalPayoutEach = 0;

        draws.rows.forEach(r => {
            const prizeBase = parseFloat(r.prize_base) || 0;
            const payoutEach = parseFloat(r.payout_each) || 0;
            const winnersCount = parseInt(r.winners_count) || 0;
            totalPrizeBase += prizeBase;
            totalPayoutEach += (payoutEach * winnersCount);

            console.log(`${r.draw_name} (ID: ${r.id})`);
            console.log(`  Prêmio Base: R$ ${prizeBase.toFixed(2)} | Payout/ganhador: R$ ${payoutEach.toFixed(2)} | Ganhadores: ${winnersCount}`);
        });

        console.log('\n========================================');
        console.log(`TOTAL (prize_base): R$ ${totalPrizeBase.toFixed(2)}`);
        console.log(`TOTAL (payout_each * winners): R$ ${totalPayoutEach.toFixed(2)}`);
        console.log('========================================');

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        process.exit();
    }
}

verifyPrizePayouts();
