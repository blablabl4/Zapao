const { query } = require('../src/database/db');

async function checkDrawStatus() {
    try {
        // 1. Get Active Draw
        const res = await query(`
            SELECT * FROM draws 
            WHERE status = 'ACTIVE' 
            ORDER BY created_at DESC 
            LIMIT 1
        `);

        if (res.rows.length === 0) {
            console.log("⚠️ Nenhuma rifa ATIVA encontrada.");
            return;
        }

        const draw = res.rows[0];
        console.log(`\n=== RIFA ATIVA: ${draw.draw_name} (ID: ${draw.id}) ===`);
        console.log(`Status: ${draw.status}`);
        console.log(`Início RAW: ${draw.start_time}`);
        console.log(`Fim RAW: ${draw.end_time}`);

        // Check current time
        const now = new Date();
        const end = new Date(draw.end_time);
        console.log(`Agora: ${now.toISOString()}`);
        console.log(`Fim Parsed: ${end.toISOString()}`);
        console.log(`Expirado? ${now > end}`);

        console.log(`Bloqueio de Vendas (sales_locked): ${draw.sales_locked}`);
        console.log(`Total de Números (total_numbers): ${draw.total_numbers}`);
        console.log(`Reservas (reserve_amount): ${draw.reserve_amount}`);

        // 2. Count Paid Tickets
        const countRes = await query(`
            SELECT COUNT(*) as sold_count 
            FROM orders 
            WHERE draw_id = $1 AND status = 'PAID'
        `, [draw.id]);

        const sold = parseInt(countRes.rows[0].sold_count);
        const total = draw.total_numbers || 100; // Default 100 if null

        console.log(`\n🎟️ Vendas: ${sold} / ${total}`);

        if (sold >= total) {
            console.log("🚨 DIAGNÓSTICO: A rifa está realmente ESGOTADA (Todos os números vendidos).");
        } else if (draw.sales_locked) {
            console.log("🚨 DIAGNÓSTICO: A rifa NÃO está esgotada, mas 'sales_locked' está TRUE. (Foi fechada manualmente?)");
        } else {
            console.log("✅ DIAGNÓSTICO: A rifa parece estar ABERTA e com números disponíveis.");
        }

    } catch (e) {
        console.error("Erro:", e);
    } finally {
        process.exit();
    }
}

checkDrawStatus();
