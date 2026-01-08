const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function analyze() {
    try {
        console.log("Fetching Last Raffle Winners...");

        // 1. Get Last Raffle and Winning Number
        const drawRes = await pool.query(`
            SELECT id, draw_name, drawn_number, payout_each
            FROM draws 
            WHERE status = 'CLOSED' 
            ORDER BY id DESC 
            LIMIT 1
        `);

        if (drawRes.rows.length === 0) {
            console.log("No closed draws found.");
            return;
        }

        const draw = drawRes.rows[0];
        console.log(`\nLast Raffle: ID ${draw.id} - ${draw.draw_name}`);
        console.log(`Winning Number: ${draw.drawn_number}`);

        if (draw.drawn_number === null) {
            console.log("No winning number set for this raffle.");
            return;
        }

        // 2. Find Winners (Users who bought the winning number)
        const winnersRes = await pool.query(`
            SELECT buyer_ref, created_at
            FROM orders
            WHERE draw_id = $1 
              AND number = $2 
              AND status = 'PAID'
        `, [draw.id, draw.drawn_number]);

        if (winnersRes.rows.length === 0) {
            console.log("No winners found (no one bought the winning number).");
            return;
        }

        const stats = {}; // Key: Amount (String) -> Count (Int)
        console.log(`\nFound ${winnersRes.rows.length} winner(s). Analyzing...`);

        // 3. For each winner, calculate the total purchase amount (cart)
        for (const winner of winnersRes.rows) {

            // Look for orders by this user in this draw, within +/- 2 mins of the winning ticket
            const cartRes = await pool.query(`
                SELECT amount
                FROM orders
                WHERE draw_id = $1 
                  AND buyer_ref = $2
                  AND status = 'PAID'
                  AND created_at >= $3::timestamp - interval '2 minutes'
                  AND created_at <= $3::timestamp + interval '2 minutes'
            `, [draw.id, winner.buyer_ref, winner.created_at]);

            let totalSpent = 0;
            cartRes.rows.forEach(o => {
                totalSpent += parseFloat(o.amount);
            });

            const valKey = totalSpent.toFixed(2);
            stats[valKey] = (stats[valKey] || 0) + 1;
        }

        // --- OUTPUT TABLE ---
        // --- OUTPUT TABLE ---
        const payout = parseFloat(draw.payout_each || 0);
        console.log(`\n### Distribuição de Apostas dos Ganhadores (Rifa ${draw.id})`);
        console.log(`Prêmio por Ganhador: R$ ${payout.toFixed(2)}`);
        console.log("| Valor da Aposta (R$) | Qtd Números (Est.) | Qtd Ganhadores | Lucro/Prejuízo | % do Total |");
        console.log("| :--- | :--- | :--- | :--- | :--- |");

        const sortedStats = Object.entries(stats).sort((a, b) => b[1] - a[1]);

        sortedStats.forEach(([val, count]) => {
            const amount = parseFloat(val);
            const cotas = Math.round(amount / 1.5);
            const profit = payout - amount;
            const profitStr = profit >= 0 ? `🟢 R$ ${profit.toFixed(2)}` : `🔴 -R$ ${Math.abs(profit).toFixed(2)}`;
            const pct = ((count / winnersRes.rows.length) * 100).toFixed(1);
            console.log(`| R$ ${val} | ${cotas} | ${count} | ${profitStr} | ${pct}% |`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

analyze();
