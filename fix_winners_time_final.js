const { query } = require('./src/database/db');

async function fixWinnersFinal() {
    try {
        console.log('Fixing times FINAL (Face Value)...');

        // Target: 22:05 Local = 01:05 UTC next day
        // We use string literals without TZ to force face value in TS-without-TZ column
        const marceloStr = '2026-01-03 01:05:00';
        const wilsonStr = '2026-01-03 01:34:00';

        console.log(`Setting Marcelo to: ${marceloStr}`);
        console.log(`Setting Wilson to:  ${wilsonStr}`);

        await query(`UPDATE orders SET created_at = '${marceloStr}' WHERE number = 46 AND buyer_ref LIKE 'Marcelo%'`);
        await query(`UPDATE payments SET paid_at = '${marceloStr}' WHERE order_id IN (SELECT order_id FROM orders WHERE number = 46 AND buyer_ref LIKE 'Marcelo%')`);

        await query(`UPDATE orders SET created_at = '${wilsonStr}' WHERE number = 46 AND buyer_ref LIKE 'Wilson%'`);
        await query(`UPDATE payments SET paid_at = '${wilsonStr}' WHERE order_id IN (SELECT order_id FROM orders WHERE number = 46 AND buyer_ref LIKE 'Wilson%')`);

        console.log('Times updated Final.');
        process.exit(0);

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

fixWinnersFinal();
