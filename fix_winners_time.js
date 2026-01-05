const { query } = require('./src/database/db');

async function fixWinners() {
    try {
        console.log('Fixing times for Marcelo and Wilson...');

        // Marcelo -> 22:05 (2026-01-02 22:05:00-03:00)
        // Wilson -> 22:34 (2026-01-02 22:34:00-03:00)
        // Note: Postgres timestamps are UTC usually or dependent on config. 
        // We will send ISO strings with offset or just calculate UTC.
        // 22:05-03:00 = 01:05 UTC (Jan 3)
        // 22:34-03:00 = 01:34 UTC (Jan 3)
        // Wait, user said "22:05" and "22:34". 
        // My previous investigation said:
        // Marcelo: 00:02 Local (03:02 UTC)
        // Wilson: 00:34 Local (03:34 UTC)
        // User wants them to be valid for a draw starting at 22:00.
        // So they must be Jan 2nd 22:05/22:34.

        const marceloTime = '2026-01-03 01:05:00+00'; // 22:05 Local
        const wilsonTime = '2026-01-03 01:34:00+00'; // 22:34 Local

        // Update Marcelo
        await query(`
            UPDATE orders 
            SET created_at = $1, 
                draw_id = 5 
            WHERE number = 46 AND buyer_ref LIKE 'Marcelo%'
        `, [marceloTime]);

        // Update payments for Marcelo if exist
        await query(`
            UPDATE payments
            SET paid_at = $1
            WHERE order_id IN (SELECT order_id FROM orders WHERE number = 46 AND buyer_ref LIKE 'Marcelo%')
        `, [marceloTime]);

        // Update Wilson
        await query(`
            UPDATE orders 
            SET created_at = $1, 
                draw_id = 5 
            WHERE number = 46 AND buyer_ref LIKE 'Wilson%'
        `, [wilsonTime]);

        // Update payments for Wilson
        await query(`
            UPDATE payments
            SET paid_at = $1
            WHERE order_id IN (SELECT order_id FROM orders WHERE number = 46 AND buyer_ref LIKE 'Wilson%')
        `, [wilsonTime]);

        console.log('Times updated.');

        // Close Draw 5 again
        const count = 2; // We know it's these 2
        const prize = 100.00;
        const payout = 50.00;

        await query(`
            UPDATE draws 
            SET status = 'CLOSED',
                drawn_number = 46,
                winners_count = $1,
                payout_each = $2,
                closed_at = NOW()
            WHERE id = 5
        `, [count, payout]);

        console.log('Draw 5 CLOSED with fixed winners.');
        process.exit(0);

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

fixWinners();
