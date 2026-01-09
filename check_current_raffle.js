const { query } = require('./src/database/db');

async function checkCurrentRaffle() {
    const phone = '11958785827';

    console.log(`\n🔍 Verificando compras na RIFA ATUAL para: +55 11 95878-5827\n`);

    // Get current active draw
    const activeDraw = await query(`
        SELECT id, draw_name, status, total_numbers
        FROM draws
        WHERE status = 'ACTIVE'
        ORDER BY created_at DESC
        LIMIT 1
    `);

    if (activeDraw.rows.length === 0) {
        console.log('❌ Nenhuma rifa ATIVA no momento.');
        return;
    }

    const draw = activeDraw.rows[0];
    console.log(`📌 Rifa Atual: ${draw.draw_name} (ID: ${draw.id})`);
    console.log(`   Status: ${draw.status}\n`);

    // Get all orders (any status) for this phone in current draw
    const allOrders = await query(`
        SELECT 
            order_id,
            number,
            amount,
            status,
            created_at,
            expires_at
        FROM orders
        WHERE buyer_ref LIKE $1
        AND draw_id = $2
        ORDER BY created_at ASC
    `, [`%${phone}%`, draw.id]);

    if (allOrders.rows.length === 0) {
        console.log('❌ Nenhum pedido encontrado para este telefone nesta rifa.');
        return;
    }

    // Separate by status
    const paid = allOrders.rows.filter(o => o.status === 'PAID');
    const pending = allOrders.rows.filter(o => o.status === 'PENDING');
    const expired = allOrders.rows.filter(o => o.status === 'EXPIRED');

    console.log('📊 RESUMO:\n');
    console.log(`✅ PAGOS: ${paid.length} números`);
    console.log(`⏳ PENDENTES: ${pending.length} números`);
    console.log(`❌ EXPIRADOS: ${expired.length} números`);
    console.log(`📋 TOTAL: ${allOrders.rows.length} pedidos\n`);

    if (paid.length > 0) {
        console.log('✅ NÚMEROS PAGOS:');
        paid.forEach(o => {
            const num = String(o.number).padStart(3, '0');
            const time = new Date(o.created_at).toLocaleString('pt-BR');
            console.log(`   ${num} - R$ ${o.amount} - ${time}`);
        });
        console.log('');
        const totalPaid = paid.reduce((sum, o) => sum + parseFloat(o.amount), 0);
        console.log(`💰 Total pago: R$ ${totalPaid.toFixed(2)}\n`);
    }

    if (pending.length > 0) {
        console.log('⏳ NÚMEROS PENDENTES (aguardando pagamento):');
        pending.forEach(o => {
            const num = String(o.number).padStart(3, '0');
            const time = new Date(o.created_at).toLocaleString('pt-BR');
            const expires = new Date(o.expires_at).toLocaleString('pt-BR');
            console.log(`   ${num} - R$ ${o.amount} - Criado: ${time} - Expira: ${expires}`);
        });
        console.log('');
    }

    if (expired.length > 0) {
        console.log('❌ NÚMEROS EXPIRADOS (não pagos a tempo):');
        expired.forEach(o => {
            const num = String(o.number).padStart(3, '0');
            const time = new Date(o.created_at).toLocaleString('pt-BR');
            console.log(`   ${num} - R$ ${o.amount} - ${time}`);
        });
        console.log('');
    }
}

checkCurrentRaffle()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('❌ Erro:', err);
        process.exit(1);
    });
