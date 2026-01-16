require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixPrize() {
    try {
        const drawId = 31; // rifa 23
        const prizeTotal = 1000;

        // Count winners (orders with drawn_number and PAID status)
        const winnersRes = await pool.query(`
            SELECT COUNT(*) as count FROM orders 
            WHERE draw_id = $1 AND number = (SELECT drawn_number FROM draws WHERE id = $1) AND status = 'PAID'
        `, [drawId]);

        const winnersCount = parseInt(winnersRes.rows[0].count) || 1;
        const payoutEach = prizeTotal / winnersCount;

        console.log(`Rifa 23 (ID ${drawId}): ${winnersCount} ganhadores, R$ ${payoutEach.toFixed(2)} cada`);

        // Update draw
        await pool.query(`
            UPDATE draws 
            SET winners_count = $1, payout_each = $2 
            WHERE id = $3
        `, [winnersCount, payoutEach, drawId]);

        console.log('✅ Atualizado!');

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

fixPrize();
