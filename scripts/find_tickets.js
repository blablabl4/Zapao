const { query } = require('../src/database/db');

async function findTickets() {
    try {
        const phone = '11979740034';

        // Find tickets
        console.log(`🔎 Buscando bilhetes para telefone: ${phone}`);

        const res = await query(`
            SELECT o.number, o.status, o.created_at, d.draw_name, o.buyer_ref, p.paid_at
            FROM orders o
            JOIN draws d ON o.draw_id = d.id
            LEFT JOIN payments p ON o.order_id = p.order_id
            WHERE o.buyer_ref LIKE $1
            ORDER BY o.created_at DESC
        `, [`%${phone}%`]);

        if (res.rows.length === 0) {
            console.log("❌ Nenhum bilhete encontrado.");
            return;
        }

        console.log(`\nEncontrados ${res.rows.length} registros:\n`);

        // Group by Draw
        const byDraw = {};

        res.rows.forEach(row => {
            if (!byDraw[row.draw_name]) byDraw[row.draw_name] = [];
            byDraw[row.draw_name].push(row);
        });

        Object.keys(byDraw).forEach(drawName => {
            console.log(`=== ${drawName} ===`);
            const tickets = byDraw[drawName];

            // Filter only PAID or PENDING
            const paid = tickets.filter(t => t.status === 'PAID');
            const others = tickets.filter(t => t.status !== 'PAID');

            if (paid.length > 0) {
                console.log(`✅ PAGOS (${paid.length}): ${paid.map(t => t.number).join(', ')}`);
                // Check if Rifa 12 matches requested "Rifa 12"
                // Assuming "Rifa 12" string is in draw_name
            }

            if (others.length > 0) {
                console.log(`⚠️ OUTROS (${others.length}):`);
                others.forEach(t => console.log(`   - Nº ${t.number} (${t.status}) em ${t.created_at}`));
            }
            console.log('');
        });

    } catch (e) {
        console.error("Erro:", e);
    } finally {
        process.exit();
    }
}

findTickets();
