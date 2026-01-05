const { query } = require('../src/database/db');

async function checkWinnerStats() {
    try {
        // 1. Get the last CLOSED draw
        const lastDrawRes = await query(`
            SELECT id, draw_name, drawn_number, closed_at 
            FROM draws 
            WHERE status = 'CLOSED' 
            ORDER BY closed_at DESC 
            LIMIT 1
        `);

        if (lastDrawRes.rows.length === 0) {
            console.log("Nenhum sorteio fechado encontrado.");
            return;
        }

        const draw = lastDrawRes.rows[0];
        console.log(`\n=== ÚLTIMO SORTEIO: ${draw.draw_name} (ID: ${draw.id}) ===`);
        console.log(`Número Sorteado: ${draw.drawn_number}`);
        console.log(`Fechado em: ${new Date(draw.closed_at).toLocaleString('pt-BR')}`);

        // 2. Identify the winner(s)
        // 'winners' column is a JSON array of winner objects
        const winners = draw.winners || []; // Array of objects

        if (winners.length === 0) {
            console.log("Nenhum ganhador registrado neste sorteio.");
            // Try to find who bought the winning number just in case
            const winnerQuery = await query(`
                SELECT buyer_ref 
                FROM orders 
                WHERE draw_id = $1 AND number = $2 AND status = 'PAID'
            `, [draw.id, draw.drawn_number]);

            if (winnerQuery.rows.length > 0) {
                console.log("Sistema encontrou o pedido vencedor na tabela orders (o JSON 'winners' pode estar vazio).");
                const w = winnerQuery.rows[0];
                const parts = w.buyer_ref ? w.buyer_ref.split('|') : [];
                winners.push({
                    name: parts[0] || 'Desconhecido',
                    phone: parts[1] || '00000000000',
                    buyer_ref: w.buyer_ref
                });
            } else {
                console.log("Ninguém comprou o número sorteado?!");
                return;
            }
        }

        // 3. For each winner, count their total tickets in this draw
        for (const winner of winners) {
            console.log(`\nAnalisando Ganhadora: ${winner.name} (Tel: ${winner.phone})`);

            // We need to match all orders from this person. 
            // Usually matched by phone inside buyer_ref OR exact buyer_ref if available.
            // Let's use phone since it's the most reliable unique ID for a user here.

            let phone = winner.phone;
            // helper to clean phone
            const cleanPhone = phone ? phone.replace(/\D/g, '') : null;

            if (!cleanPhone) {
                console.log("Telefone inválido, não consigo buscar outros pedidos.");
                continue;
            }

            const countRes = await query(`
                SELECT COUNT(*) as total_tickets 
                FROM orders 
                WHERE draw_id = $1 
                  AND status = 'PAID'
                  AND buyer_ref LIKE $2
            `, [
                draw.id,
                `%${cleanPhone}%`
            ]);

            const total = countRes.rows[0].total_tickets;
            console.log(`TOTAL DE NÚMEROS COMPRADOS: ${total}`);

            // List the numbers for fun
            const numbersRes = await query(`
                SELECT number 
                FROM orders 
                WHERE draw_id = $1 
                  AND status = 'PAID' 
                  AND buyer_ref LIKE $2
                ORDER BY number ASC
            `, [draw.id, `%${cleanPhone}%`]);

            const nums = numbersRes.rows.map(r => r.number).join(', ');
            console.log(`Números: ${nums}`);
        }

    } catch (e) {
        console.error("Erro:", e);
    } finally {
        process.exit();
    }
}

checkWinnerStats();
