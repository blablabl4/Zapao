const { query } = require('./src/database/db');

async function fixWinnersV2() {
    try {
        console.log('Fixing times for Marcelo and Wilson (v2)...');

        // Explicit Local Times with Offset (-03)
        const marceloTime = '2026-01-02 22:05:00-03';
        const wilsonTime = '2026-01-02 22:34:00-03';

        console.log(`Setting Marcelo to: ${marceloTime}`);
        console.log(`Setting Wilson to:  ${wilsonTime}`);

        // Update Marcelo
        await query(`
            UPDATE orders 
            SET created_at = $1, 
                draw_id = 5 
            WHERE number = 46 AND buyer_ref LIKE 'Marcelo%'
        `, [marceloTime]);

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

        await query(`
            UPDATE payments
            SET paid_at = $1
            WHERE order_id IN (SELECT order_id FROM orders WHERE number = 46 AND buyer_ref LIKE 'Wilson%')
        `, [wilsonTime]);

        console.log('Times updated v2.');
        process.exit(0);

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

fixWinnersV2();
