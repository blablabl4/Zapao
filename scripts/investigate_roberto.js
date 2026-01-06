const { query } = require('../src/database/db');

async function investigateRoberto() {
    const phone = '11994956692';

    try {
        console.log(`\n========================================`);
        console.log(`INVESTIGANDO PAGAMENTOS DO ROBERTO`);
        console.log(`Telefone: ${phone}`);
        console.log(`Data: 06/01/2026 (hoje)`);
        console.log(`========================================\n`);

        // ALL orders from today for this phone (all statuses)
        const todayOrders = await query(`
            SELECT o.order_id, o.number, o.amount, o.status, o.created_at, o.draw_id, d.draw_name
            FROM orders o
            LEFT JOIN draws d ON o.draw_id = d.id
            WHERE o.buyer_ref LIKE $1
            AND o.created_at >= '2026-01-06 00:00:00'
            ORDER BY o.created_at DESC
        `, [`%${phone}%`]);

        console.log(`=== TODOS OS PEDIDOS DE HOJE (${todayOrders.rows.length}) ===\n`);

        // Group by status
        const byStatus = {};
        todayOrders.rows.forEach(r => {
            if (!byStatus[r.status]) byStatus[r.status] = [];
            byStatus[r.status].push(r);
        });

        Object.keys(byStatus).forEach(status => {
            console.log(`\n--- ${status}: ${byStatus[status].length} pedidos ---`);
            byStatus[status].forEach(r => {
                const time = new Date(r.created_at).toLocaleTimeString('pt-BR');
                console.log(`  Num ${r.number} | Draw ${r.draw_id} (${r.draw_name}) | R$ ${parseFloat(r.amount).toFixed(2)} | ${time}`);
            });
        });

        // Check around 12:14
        console.log('\n=== PEDIDOS CRIADOS ENTRE 12:00 e 12:30 ===\n');
        const aroundNoon = await query(`
            SELECT o.order_id, o.number, o.amount, o.status, o.created_at, o.draw_id, d.draw_name
            FROM orders o
            LEFT JOIN draws d ON o.draw_id = d.id
            WHERE o.buyer_ref LIKE $1
            AND o.created_at >= '2026-01-06 12:00:00'
            AND o.created_at <= '2026-01-06 12:30:00'
            ORDER BY o.created_at ASC
        `, [`%${phone}%`]);

        aroundNoon.rows.forEach(r => {
            const time = new Date(r.created_at).toLocaleTimeString('pt-BR');
            console.log(`${time} | Num ${r.number} | ${r.status} | Draw ${r.draw_id} (${r.draw_name}) | ID: ${r.order_id.substring(0, 8)}`);
        });

        // Summary
        console.log('\n=== RESUMO ===');
        console.log(`Total hoje: ${todayOrders.rows.length} pedidos`);

        const paidToday = todayOrders.rows.filter(r => r.status === 'PAID');
        console.log(`PAID hoje: ${paidToday.length}`);
        if (paidToday.length > 0) {
            console.log(`  Números PAID: ${paidToday.map(r => r.number).join(', ')}`);
            console.log(`  Rifas: ${[...new Set(paidToday.map(r => r.draw_name))].join(', ')}`);
        }

        // Current active draw
        const activeDraw = await query(`SELECT id, draw_name FROM draws WHERE status = 'ACTIVE' LIMIT 1`);
        if (activeDraw.rows.length > 0) {
            console.log(`\nRifa Ativa: ${activeDraw.rows[0].draw_name} (ID: ${activeDraw.rows[0].id})`);

            const paidInActive = paidToday.filter(r => r.draw_id === activeDraw.rows[0].id);
            console.log(`Números PAID nesta rifa: ${paidInActive.length}`);
        }

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        process.exit();
    }
}

investigateRoberto();
