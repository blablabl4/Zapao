const { query } = require('../src/database/db');

async function fixRaffle() {
    try {
        console.log("🔓 Desbloqueando Rifa 15 (ID 20)...");

        // Force unlock and set start time to immediate past to ensure it's "started"
        const res = await query(`
            UPDATE draws 
            SET sales_locked = FALSE,
                start_time = NOW() - INTERVAL '1 hour'
            WHERE id = 20
            RETURNING *
        `);

        if (res.rows.length > 0) {
            const draw = res.rows[0];
            console.log("✅ Rifa atualizada com sucesso!");
            console.log(`Novo Status: ${draw.status}`);
            console.log(`Sales Locked: ${draw.sales_locked}`);
            console.log(`Start Time: ${draw.start_time}`);
        } else {
            console.log("❌ Rifa ID 20 não encontrada.");
        }

    } catch (e) {
        console.error("Erro:", e);
    } finally {
        process.exit();
    }
}

fixRaffle();
