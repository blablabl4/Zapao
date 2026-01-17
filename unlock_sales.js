// Script to ONLY unlock sales (keep current time)
const { query } = require('./src/database/db');

async function unlockSales() {
    try {
        // Just unlock sales_locked
        const result = await query(`
            UPDATE draws 
            SET sales_locked = FALSE
            WHERE status IN ('ACTIVE', 'SCHEDULED', 'PAUSED')
            RETURNING id, draw_name, sales_locked, status, end_time
        `);

        console.log('Sales unlocked!');
        console.log(result.rows);

        process.exit(0);
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}

unlockSales();
