require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkWinnerDisplay() {
    try {
        // Rifa 25 = draw_id 33, drawn_number = 6
        const drawId = 33;
        const drawnNumber = 6;

        console.log(`\n=== Verificando ganhadores da Rifa 25 (número ${drawnNumber}) ===\n`);

        // Get all winners for this draw
        const res = await pool.query(`
            SELECT o.order_id, o.number, o.buyer_ref, o.created_at, o.status
            FROM orders o
            WHERE o.draw_id = $1 AND o.number = $2 AND o.status = 'PAID'
            ORDER BY o.created_at ASC
        `, [drawId, drawnNumber]);

        console.log(`Total de ganhadores: ${res.rows.length}\n`);

        for (const row of res.rows) {
            const parts = (row.buyer_ref || '').split('|');
            console.log('---');
            console.log(`Order ID: ${row.order_id}`);
            console.log(`buyer_ref: ${row.buyer_ref}`);
            console.log(`Nome extraído: ${parts[0] || 'N/A'}`);
            console.log(`Telefone: ${parts[1] || 'N/A'}`);
            console.log(`PIX: ${parts[2] || 'N/A'}`);
            console.log(`Nome exibido (primeiro + segundo): ${parts[0] ? parts[0].split(' ')[0] + ' ' + (parts[0].split(' ')[1] || '') : 'Ganhador'}`);
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

checkWinnerDisplay();
