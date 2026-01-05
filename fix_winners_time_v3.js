const { query } = require('./src/database/db');

async function fixWinnersV3() {
    try {
        console.log('Fixing times for Marcelo and Wilson (v3 - Explicit UTC)...');

        // Target: 
        // Marcelo: Jan 2, 22:05 Local => Jan 3, 01:05 UTC
        // Wilson:  Jan 2, 22:34 Local => Jan 3, 01:34 UTC

        const marceloUTC = '2026-01-03 01:05:00+00';
        const wilsonUTC = '2026-01-03 01:34:00+00';

        console.log(`Setting Marcelo to: ${marceloUTC}`);
        console.log(`Setting Wilson to:  ${wilsonUTC}`);

        // Update Marcelo
        await query(`
            UPDATE orders 
            SET created_at = $1 
            WHERE number = 46 AND buyer_ref LIKE 'Marcelo%'
        `, [marceloUTC]);

        await query(`
            UPDATE payments
            SET paid_at = $1
            WHERE order_id IN (SELECT order_id FROM orders WHERE number = 46 AND buyer_ref LIKE 'Marcelo%')
        `, [marceloUTC]);

        // Update Wilson
        await query(`
            UPDATE orders 
            SET created_at = $1 
            WHERE number = 46 AND buyer_ref LIKE 'Wilson%'
        `, [wilsonUTC]);

        await query(`
            UPDATE payments
            SET paid_at = $1
            WHERE order_id IN (SELECT order_id FROM orders WHERE number = 46 AND buyer_ref LIKE 'Wilson%')
        `, [wilsonUTC]);

        console.log('Times updated v3 (UTC).');
        process.exit(0);

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

fixWinnersV3();
