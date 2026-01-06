const { query } = require('../src/database/db');

async function investigateDuplicates() {
    const phone = '11994956692';

    try {
        console.log(`\n========================================`);
        console.log(`INVESTIGANDO PAGAMENTOS DUPLICADOS`);
        console.log(`Telefone: ${phone}`);
        console.log(`========================================\n`);

        // Get ALL PAID orders for this phone
        const paidOrders = await query(`
            SELECT o.order_id, o.number, o.amount, o.status, o.created_at, o.draw_id, d.draw_name, o.buyer_ref
            FROM orders o 
            LEFT JOIN draws d ON o.draw_id = d.id 
            WHERE o.buyer_ref LIKE $1 AND o.status = 'PAID'
            ORDER BY o.created_at ASC
        `, [`%${phone}%`]);

        console.log(`=== PEDIDOS COM STATUS PAID (${paidOrders.rows.length}) ===\n`);

        paidOrders.rows.forEach((r, i) => {
            console.log(`[${i + 1}] ID: ${r.order_id}`);
            console.log(`    Rifa: ${r.draw_name} (ID: ${r.draw_id})`);
            console.log(`    Número: ${r.number}`);
            console.log(`    Valor: R$ ${parseFloat(r.amount).toFixed(2)}`);
            console.log(`    Criado: ${r.created_at}`);
            console.log('');
        });

        // Check if same NUMBER was paid multiple times (ghost)
        const duplicateNumbers = await query(`
            SELECT number, COUNT(*) as count, SUM(amount) as total
            FROM orders
            WHERE buyer_ref LIKE $1 AND status = 'PAID'
            GROUP BY number
            HAVING COUNT(*) > 1
        `, [`%${phone}%`]);

        if (duplicateNumbers.rows.length > 0) {
            console.log(`\n🚨 ALERTA: NÚMEROS PAGOS MÚLTIPLAS VEZES!\n`);
            duplicateNumbers.rows.forEach(r => {
                console.log(`  Número ${r.number}: ${r.count} pagamentos (Total: R$ ${parseFloat(r.total).toFixed(2)})`);
            });
        }

        // Check BATCH patterns - orders created at same time
        console.log(`\n=== ANÁLISE DE BATCH (Criados ao mesmo tempo) ===\n`);

        const batchAnalysis = await query(`
            SELECT 
                DATE_TRUNC('second', created_at) as batch_time,
                COUNT(*) as count,
                STRING_AGG(number::text, ', ') as numbers,
                STRING_AGG(status, ', ') as statuses
            FROM orders
            WHERE buyer_ref LIKE $1
            GROUP BY DATE_TRUNC('second', created_at)
            HAVING COUNT(*) > 1
            ORDER BY batch_time DESC
            LIMIT 10
        `, [`%${phone}%`]);

        if (batchAnalysis.rows.length > 0) {
            batchAnalysis.rows.forEach(r => {
                console.log(`Batch: ${r.batch_time}`);
                console.log(`  Números: ${r.numbers}`);
                console.log(`  Status: ${r.statuses}`);
                console.log(`  Qtd: ${r.count}`);
                console.log('');
            });
        }

        // Check for ghost payments globally
        console.log(`\n=== VERIFICAÇÃO GLOBAL DE INTEGRIDADE ===\n`);

        // All PAID orders today
        const todayPaid = await query(`
            SELECT COUNT(*) as count, SUM(amount) as total
            FROM orders
            WHERE status = 'PAID' AND created_at >= CURRENT_DATE
        `);

        console.log(`Pedidos PAID hoje: ${todayPaid.rows[0].count} (R$ ${parseFloat(todayPaid.rows[0].total || 0).toFixed(2)})`);

        // Total revenue from this phone
        const phoneRevenue = await query(`
            SELECT COUNT(*) as count, SUM(amount) as total
            FROM orders
            WHERE buyer_ref LIKE $1 AND status = 'PAID'
        `, [`%${phone}%`]);

        console.log(`\nPedidos PAID deste telefone: ${phoneRevenue.rows[0].count} (R$ ${parseFloat(phoneRevenue.rows[0].total || 0).toFixed(2)})`);

        if (phoneRevenue.rows[0].count > 1) {
            console.log(`\n⚠️  Se o Mercado Pago só mostra 1 transação, há ${phoneRevenue.rows[0].count - 1} pagamento(s) fantasma!`);
        }

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        process.exit();
    }
}

investigateDuplicates();
