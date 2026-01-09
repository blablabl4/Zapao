const { query } = require('./src/database/db');

async function checkPhone() {
    const phone = '11958785827'; // normalized without formatting

    console.log(`\n🔍 Buscando pedidos para: ${phone}\n`);

    // Get all PAID orders for this phone
    const result = await query(`
        SELECT 
            o.order_id,
            o.number,
            o.amount,
            o.status,
            o.created_at,
            o.buyer_ref,
            d.draw_name,
            d.id as draw_id
        FROM orders o
        LEFT JOIN draws d ON o.draw_id = d.id
        WHERE o.buyer_ref LIKE $1
        AND o.status = 'PAID'
        ORDER BY o.created_at DESC
    `, [`%${phone}%`]);

    if (result.rows.length === 0) {
        console.log('❌ Nenhum pedido PAGO encontrado para este telefone.');
        return;
    }

    console.log(`✅ Total de números comprados (PAGOS): ${result.rows.length}\n`);

    // Group by draw
    const byDraw = {};
    result.rows.forEach(order => {
        const drawName = order.draw_name || `Draw #${order.draw_id}`;
        if (!byDraw[drawName]) {
            byDraw[drawName] = [];
        }
        byDraw[drawName].push(order.number);
    });

    // Display
    Object.keys(byDraw).forEach(drawName => {
        const numbers = byDraw[drawName];
        console.log(`📌 ${drawName}: ${numbers.length} números`);
        console.log(`   Números: ${numbers.sort((a, b) => a - b).map(n => String(n).padStart(3, '0')).join(', ')}`);
        console.log('');
    });

    // Summary
    const totalAmount = result.rows.reduce((sum, o) => sum + parseFloat(o.amount), 0);
    console.log(`💰 Total pago: R$ ${totalAmount.toFixed(2)}`);
    console.log(`📊 Total de pedidos: ${result.rows.length}`);
}

checkPhone()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('❌ Erro:', err);
        process.exit(1);
    });
