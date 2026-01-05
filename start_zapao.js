const { query } = require('./src/database/db');

async function startDraw() {
    console.log('--- Iniciando Rodada Zapão da Sorte (1-75) ---');

    // Close any active draws to be safe
    await query("UPDATE draws SET status = 'CLOSED', closed_at = NOW() WHERE status = 'ACTIVE'");

    // Start new draw
    // Prize Base: 100.00 (Example)
    const result = await query(`
        INSERT INTO draws (draw_name, status, prize_base, reserve_amount, start_time, duration_minutes, sales_locked)
        VALUES ($1, 'ACTIVE', $2, 0.00, NOW(), 1440, FALSE)
        RETURNING *
    `, ['Zapão - Rodada 01', 100.00]);

    const draw = result.rows[0];
    console.log(`✅ Rodada #${draw.id} iniciada! Status: ${draw.status}`);
    console.log(`✅ Base de Prêmios: R$ ${draw.prize_base}`);

    process.exit(0);
}

startDraw();
