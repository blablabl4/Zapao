const { query } = require('./src/database/db');

async function getTransactionDetails() {
    const phone = '11958785827';

    console.log(`\n📋 RELATÓRIO COMPLETO DE TRANSAÇÕES - Rifa 18`);
    console.log(`Cliente: +55 11 95878-5827\n`);
    console.log('='.repeat(80));

    // Get ALL orders (paid and expired)
    const allOrders = await query(`
        SELECT 
            o.order_id,
            o.number,
            o.amount,
            o.status,
            o.created_at,
            o.expires_at,
            p.txid,
            p.amount_paid,
            p.paid_at,
            p.provider
        FROM orders o
        LEFT JOIN payments p ON o.order_id = p.order_id
        WHERE o.buyer_ref LIKE $1
        AND o.draw_id = 23
        ORDER BY o.number ASC
    `, [`%${phone}%`]);

    const paid = allOrders.rows.filter(o => o.status === 'PAID');
    const expired = allOrders.rows.filter(o => o.status === 'EXPIRED');

    console.log(`\n✅ PAGAMENTOS APROVADOS (${paid.length}):\n`);

    paid.forEach((o, idx) => {
        console.log(`${idx + 1}. Número: ${String(o.number).padStart(3, '0')}`);
        console.log(`   Order ID: ${o.order_id}`);
        console.log(`   Mercado Pago ID: ${o.txid}`);
        console.log(`   Valor: R$ ${o.amount_paid || o.amount}`);
        console.log(`   Pago em: ${new Date(o.paid_at).toLocaleString('pt-BR')}`);
        console.log('');
    });

    console.log('='.repeat(80));
    console.log(`\n❌ PEDIDOS NÃO APROVADOS - EXPIRADOS (${expired.length}):\n`);

    expired.forEach((o, idx) => {
        console.log(`${idx + 1}. Número: ${String(o.number).padStart(3, '0')}`);
        console.log(`   Order ID: ${o.order_id}`);
        console.log(`   Status: EXPIRADO (não pago a tempo)`);
        console.log(`   Criado em: ${new Date(o.created_at).toLocaleString('pt-BR')}`);
        console.log(`   Expirou em: ${new Date(o.expires_at).toLocaleString('pt-BR')}`);
        console.log(`   ⚠️  SEM ID Mercado Pago (pagamento não confirmado)`);
        console.log('');
    });

    console.log('='.repeat(80));
    console.log(`\n📊 RESUMO PARA O CLIENTE:\n`);
    console.log(`Números CONFIRMADOS: ${paid.map(o => String(o.number).padStart(3, '0')).join(', ')}`);
    console.log(`Total pago: R$ ${paid.reduce((sum, o) => sum + parseFloat(o.amount), 0).toFixed(2)}`);
    console.log(`\nNúmeros NÃO confirmados (expirados): ${expired.map(o => String(o.number).padStart(3, '0')).join(', ')}`);
    console.log(`\n⚠️  Estes ${expired.length} números expiraram porque o pagamento não foi confirmado`);
    console.log(`pelo Mercado Pago em até 10 minutos após a geração do Pix.\n`);
}

getTransactionDetails()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('❌ Erro:', err);
        process.exit(1);
    });
