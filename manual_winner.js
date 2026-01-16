require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function manualWinner() {
    try {
        const number = 132;

        // 1. Find the active draw (assuming #23 is the active one or recently active)
        // Or find by name 'Rodada 23'?
        // Let's find the current active draw
        const drawRes = await pool.query("SELECT * FROM draws WHERE status = 'ACTIVE' LIMIT 1");

        let drawId;
        if (drawRes.rows.length === 0) {
            console.log('⚠️ No ACTIVE draw found. Checking for open draws...');
            // Maybe it's not 'ACTIVE' but has no winner yet?
            const fallback = await pool.query("SELECT * FROM draws ORDER BY created_at DESC LIMIT 1");
            drawId = fallback.rows[0].id;
            console.log(`Using latest draw: ${fallback.rows[0].name} (ID: ${drawId})`);
        } else {
            drawId = drawRes.rows[0].id;
            console.log(`Found active draw: ${drawRes.rows[0].name} (ID: ${drawId})`);
        }

        // 2. Set winner
        console.log(`Setting winner ${number} for draw ${drawId}...`);

        await pool.query(`
            UPDATE draws 
            SET status = 'CLOSED', 
                drawn_number = $1
            WHERE id = $2
        `, [number, drawId]);

        console.log('✅ Draw CLOSED and winner set!');

        // 3. Find who bought the number
        const winnerRes = await pool.query(`
            SELECT buyer_ref FROM orders 
            WHERE draw_id = $1 AND number = $2 AND status = 'PAID'
            LIMIT 1
        `, [drawId, number]);

        if (winnerRes.rows.length > 0) {
            console.log('🏆 WINNER FOUND:', winnerRes.rows[0].buyer_ref);
        } else {
            console.log('⚠️ No one bought number ' + number + ' (House wins?)');
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

manualWinner();
