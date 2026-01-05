const { query } = require('./src/database/db');

async function revertAndReset() {
    try {
        console.log('Moving orders #46 back to Draw 3...');
        // Identify the orders currently in Draw 5 with number 46
        const res = await query(`
            UPDATE orders 
            SET draw_id = 3
            WHERE draw_id = 5 
              AND number = 46 
              AND status = 'PAID'
        `);
        console.log(`Moved ${res.rowCount} orders back to Draw 3.`);

        console.log('Resetting Draw 5 to ACTIVE...');
        await query(`
            UPDATE draws 
            SET status = 'ACTIVE', 
                drawn_number = NULL,
                winners_count = 0,
                payout_each = 0,
                closed_at = NULL
            WHERE id = 5
        `);

        console.log('Draw 5 reset. Ready to spin.');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

revertAndReset();
