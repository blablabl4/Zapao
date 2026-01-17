// Script to unlock current draw
const { query } = require('./src/database/db');

async function unlockDraw() {
    try {
        console.log('Checking current draw status...');

        // Get current draw
        const current = await query(`
            SELECT id, draw_name, status, sales_locked, end_time 
            FROM draws 
            ORDER BY id DESC 
            LIMIT 1
        `);

        if (current.rows.length === 0) {
            console.log('No draws found!');
            process.exit(1);
        }

        const draw = current.rows[0];
        console.log('Current draw:', draw);

        // Unlock and set to ACTIVE with new end_time (2 hours from now)
        const newEndTime = new Date(Date.now() + 2 * 60 * 60 * 1000);

        const result = await query(`
            UPDATE draws 
            SET sales_locked = FALSE, 
                status = 'ACTIVE',
                end_time = $1
            WHERE id = $2
            RETURNING *
        `, [newEndTime, draw.id]);

        console.log('Draw unlocked and extended!');
        console.log('New status:', result.rows[0]);

        process.exit(0);
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}

unlockDraw();
