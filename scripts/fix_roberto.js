const { query } = require('../src/database/db');

async function fixRobertoPayments() {
    const phone = '11994956692';

    try {
        console.log(`\n=== CORRIGINDO PAGAMENTOS DO ROBERTO ===\n`);

        const today = '2026-01-06';

        // Get unique numbers and their FIRST order (earliest created_at)
        const uniqueOrders = await query(`
            SELECT DISTINCT ON (number) order_id, number, status, created_at
            FROM orders
            WHERE buyer_ref LIKE $1
            AND draw_id = 21
            AND created_at >= $2
            AND status = 'EXPIRED'
            ORDER BY number, created_at ASC
        `, [`%${phone}%`, today]);

        console.log(`Encontrados ${uniqueOrders.rows.length} números únicos para corrigir:\n`);
        console.log(`Números: ${uniqueOrders.rows.map(r => r.number).sort((a, b) => a - b).join(', ')}`);

        // Apply the fix
        const ids = uniqueOrders.rows.map(r => r.order_id);
        const result = await query(`
            UPDATE orders 
            SET status = 'PAID' 
            WHERE order_id = ANY($1)
            RETURNING number
        `, [ids]);

        console.log(`\n✅ CORRIGIDO! ${result.rowCount} pedidos atualizados para PAID.`);
        console.log(`Números: ${result.rows.map(r => r.number).sort((a, b) => a - b).join(', ')}`);

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        process.exit();
    }
}

fixRobertoPayments();
