const { query } = require('./src/database/db');

async function migrateAndClose() {
    try {
        console.log('Migrating orders #46 to Draw 5...');
        const moveRes = await query(`
            UPDATE orders 
            SET draw_id = 5 
            WHERE number = 46 
              AND status = 'PAID'
        `);
        console.log(`Moved ${moveRes.rowCount} orders to Draw 5.`);

        console.log('Force closing Draw 5...');
        const winners = await query(`
            SELECT * FROM orders 
            WHERE draw_id = 5 
              AND number = 46 
              AND status = 'PAID'
        `);

        const count = winners.rows.length;
        const prize = 100.00;
        const payoutEach = count > 0 ? prize / count : 0;

        await query(`
            UPDATE draws 
            SET status = 'CLOSED',
                drawn_number = 46,
                winners_count = $1,
                payout_each = $2,
                closed_at = NOW()
            WHERE id = 5
        `, [count, payoutEach]);

        console.log(`Draw 5 CLOSED with ${count} winners. Payout: ${payoutEach}`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

migrateAndClose();
