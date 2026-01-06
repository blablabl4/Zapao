const { query } = require('../src/database/db');

async function getTotalPrizesPaid() {
    try {
        // Get all closed draws that have winners (drawn_number is not null)
        console.log('=== RIFAS COM GANHADORES (Prêmios Válidos) ===\n');
        const draws = await query(`
            SELECT id, draw_name, status, prize_base, drawn_number
            FROM draws 
            WHERE status = 'CLOSED' AND drawn_number IS NOT NULL
            ORDER BY id
        `);

        let totalPrizes = 0;
        draws.rows.forEach(r => {
            const prize = parseFloat(r.prize_base) || 0;
            totalPrizes += prize;
            console.log(`${r.draw_name} (ID: ${r.id}) | Número Sorteado: ${r.drawn_number} | Prêmio: R$ ${prize.toFixed(2)}`);
        });

        console.log('\n========================================');
        console.log(`TOTAL DE PRÊMIOS PAGOS: R$ ${totalPrizes.toFixed(2)}`);
        console.log(`Total de Rifas com Ganhadores: ${draws.rows.length}`);
        console.log('========================================');

        // Also show draws without winners
        console.log('\n=== RIFAS SEM GANHADORES ===\n');
        const noWinners = await query(`
            SELECT id, draw_name, status, prize_base, drawn_number
            FROM draws 
            WHERE status = 'CLOSED' AND (drawn_number IS NULL)
            ORDER BY id
        `);

        noWinners.rows.forEach(r => {
            console.log(`${r.draw_name} (ID: ${r.id}) | Sem número sorteado`);
        });

        if (noWinners.rows.length === 0) {
            console.log('Nenhuma rifa fechada sem ganhador.');
        }

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        process.exit();
    }
}

getTotalPrizesPaid();
