const { query } = require('./src/database/db');

async function resetDraw5() {
    try {
        console.log('Resetting Draw 5...');
        await query(`
            UPDATE draws 
            SET status = 'ACTIVE', 
                drawn_number = NULL,
                winners_count = 0,
                payout_each = 0,
                closed_at = NULL
            WHERE id = 5
        `);
        console.log('Draw 5 reset to ACTIVE (ready to spin again).');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

resetDraw5();
