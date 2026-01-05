const { query } = require('../src/database/db');

async function extendRaffle() {
    try {
        console.log("⏳ Estendendo prazo da Rifa 15 (ID 20)...");

        // Set end_time to tomorrow (relative to NOW)
        const res = await query(`
            UPDATE draws 
            SET end_time = NOW() + INTERVAL '24 hours'
            WHERE id = 20
            RETURNING *
        `);

        if (res.rows.length > 0) {
            const draw = res.rows[0];
            console.log("✅ Prazo estendido!");
            console.log(`Novo Fim: ${draw.end_time}`);
        } else {
            console.log("❌ Rifa ID 20 não encontrada.");
        }

    } catch (e) {
        console.error("Erro:", e);
    } finally {
        process.exit();
    }
}

extendRaffle();
