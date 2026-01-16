require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkTiming() {
    try {
        // Rifa 25 = draw_id 33
        const drawId = 33;

        // Get draw close time
        const drawRes = await pool.query("SELECT * FROM draws WHERE id = $1", [drawId]);
        const draw = drawRes.rows[0];

        console.log(`\n=== Timing da Rifa 25 ===\n`);
        console.log(`End Time (previsto): ${draw.end_time}`);
        console.log(`Lock Time: ${draw.lock_time}`);
        console.log(`Closed At: ${draw.closed_at || 'N/A'}`);

        // Get Diego's order
        const diegoRes = await pool.query(`
            SELECT * FROM orders 
            WHERE draw_id = $1 AND buyer_ref LIKE '%11966310671%' AND number = 6 AND status = 'PAID'
        `, [drawId]);

        if (diegoRes.rows.length > 0) {
            const diego = diegoRes.rows[0];
            console.log(`\n=== Pedido do Diego ===`);
            console.log(`Created At: ${diego.created_at}`);
            console.log(`Updated At: ${diego.updated_at}`);
            console.log(`Status: ${diego.status}`);

            // Check if his payment was after lock
            const lockTime = new Date(draw.lock_time);
            const orderCreated = new Date(diego.created_at);
            const orderUpdated = new Date(diego.updated_at);

            console.log(`\n=== Comparação ===`);
            console.log(`Lock da Rifa: ${lockTime.toLocaleString('pt-BR')}`);
            console.log(`Pedido criado: ${orderCreated.toLocaleString('pt-BR')}`);
            console.log(`Pedido atualizado: ${orderUpdated.toLocaleString('pt-BR')}`);

            if (orderUpdated > lockTime) {
                console.log(`\n⚠️ Pagamento confirmado APÓS o lock da rifa!`);
                console.log(`   Diferença: ${Math.round((orderUpdated - lockTime) / 1000)} segundos depois`);
            } else {
                console.log(`\n✅ Pagamento confirmado ANTES do lock.`);
            }
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

checkTiming();
