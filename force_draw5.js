const { query } = require('./src/database/db');

async function forceDraw5() {
    try {
        console.log('Checking winners for #46 in Draw 5...');
        const winners = await query(`
            SELECT * FROM orders 
            WHERE draw_id = 5 
              AND number = 46 
              AND status = 'PAID'
        `);

        const count = winners.rows.length;
        console.log(`Found ${count} valid winners for Draw 5, Number 46.`);

        if (count > 0) {
            winners.rows.forEach(w => console.log(`- ${w.buyer_ref.split('|')[0]}`));

            // Calculate payout
            // We need current prize_base + reserve. 
            // Draw 5: prize_base=100.
            const prize = 100.00;
            const payoutEach = prize / count;

            console.log(`Updating Draw 5: CLOSED, Number 46, ${count} winners, R$ ${payoutEach} each.`);

            await query(`
                UPDATE draws 
                SET status = 'CLOSED',
                    drawn_number = 46,
                    winners_count = $1,
                    payout_each = $2,
                    closed_at = NOW()
                WHERE id = 5
            `, [count, payoutEach]);

            console.log('Success! Draw 5 closed.');
        } else {
            console.log('No winners found. Aborting force update.');
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

forceDraw5();
