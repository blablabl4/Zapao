const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function analyze() {
    try {
        console.log("Fetching PAID orders...");

        const orders = await pool.query(`
            SELECT draw_id, buyer_ref, amount, created_at, number
            FROM orders 
            WHERE status = 'PAID'
            ORDER BY created_at DESC
            LIMIT 50000
        `);

        if (orders.rows.length === 0) {
            console.log("No paid orders found.");
            return;
        }

        const map = new Map();

        orders.rows.forEach(o => {
            if (!o.buyer_ref) return;
            const date = new Date(o.created_at);
            const timeKey = Math.floor(date.getTime() / (2 * 60 * 1000));
            const key = `${o.draw_id}|${o.buyer_ref}|${timeKey}`;

            if (!map.has(key)) map.set(key, 0);
            map.set(key, map.get(key) + parseFloat(o.amount));
        });

        // Aggregate Stats
        const globalCounts = {};
        const drawCounts = {};

        for (const [key, total] of map.entries()) {
            const [drawIdStr] = key.split('|');
            const drawId = parseInt(drawIdStr);
            const val = total.toFixed(2);

            // Global
            globalCounts[val] = (globalCounts[val] || 0) + 1;

            // Per Draw
            if (!drawCounts[drawId]) drawCounts[drawId] = {};
            drawCounts[drawId][val] = (drawCounts[drawId][val] || 0) + 1;
        }

        // --- OUTPUT ---

        console.log(`\nAnalyzed ${map.size} reconstructed transactions from ${orders.rows.length} numbers.`);

        // 1. GLOBAL (GERAL)
        const sortedGlobal = Object.entries(globalCounts).sort((a, b) => b[1] - a[1]);

        console.log("\n### Tabela Geral de Transações");
        console.log("| Valor (R$) | Qtd Vendas | % do Total |");
        console.log("| :--- | :--- | :--- |");

        let cumulativePct = 0;
        sortedGlobal.forEach(([val, count]) => {
            const pct = (count / map.size) * 100;
            cumulativePct += pct;
            console.log(`| R$ ${val} | ${count} | ${pct.toFixed(2)}% |`);
        });

        // 2. PER RAFFLE (POR RIFA)
        console.log("\n### Tabela por Rifa (Detalhada)");
        const drawIds = Object.keys(drawCounts).map(Number).sort((a, b) => b - a);

        const drawNamesRes = await pool.query("SELECT id, draw_name FROM draws WHERE id = ANY($1)", [drawIds]);
        const drawNames = {};
        drawNamesRes.rows.forEach(d => drawNames[d.id] = d.draw_name);

        // Limit to last 5 draws for cleaner output, or user can request more
        drawIds.slice(0, 5).forEach(did => {
            const counts = drawCounts[did];
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            const totalDraw = sorted.reduce((acc, curr) => acc + curr[1], 0);
            const name = drawNames[did] || `Rifa ${did}`;

            console.log(`\n#### ID ${did}: ${name} (Total: ${totalDraw} vendas)`);
            console.log("| Valor (R$) | Qtd Vendas | % da Rifa |");
            console.log("| :--- | :--- | :--- |");

            sorted.forEach(([val, count]) => {
                const pct = ((count / totalDraw) * 100).toFixed(2);
                console.log(`| R$ ${val} | ${count} | ${pct}% |`);
            });
        });

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

analyze();
