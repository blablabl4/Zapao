const { query } = require('./src/database/db');

async function checkTransactions() {
    const phone = '11958785827';

    console.log(`\n🔍 Verificando TRANSAÇÕES para: +55 11 95878-5827 na Rifa 18\n`);

    // Get paid orders with payment info
    const result = await query(`
        SELECT 
            o.order_id,
            o.number,
            o.amount,
            o.created_at,
            o.buyer_ref,
            p.txid,
            p.amount_paid,
            p.paid_at,
            p.provider
        FROM orders o
        LEFT JOIN payments p ON o.order_id = p.order_id
        WHERE o.buyer_ref LIKE $1
        AND o.draw_id = 23
        AND o.status = 'PAID'
        ORDER BY o.created_at ASC
    `, [`%${phone}%`]);

    if (result.rows.length === 0) {
        console.log('❌ Nenhum pedido pago encontrado.');
        return;
    }

    console.log(`✅ Total de números pagos: ${result.rows.length}\n`);

    // Group by transaction (txid)
    const byTransaction = {};
    result.rows.forEach(order => {
        const txid = order.txid || 'SEM_TXID';
        if (!byTransaction[txid]) {
            byTransaction[txid] = [];
        }
        byTransaction[txid].push(order);
    });

    const numTransactions = Object.keys(byTransaction).length;

    console.log(`💳 Total de TRANSAÇÕES: ${numTransactions}\n`);
    console.log('='.repeat(70));

    Object.keys(byTransaction).forEach((txid, index) => {
        const orders = byTransaction[txid];
        const totalAmount = orders.reduce((sum, o) => sum + parseFloat(o.amount_paid || o.amount), 0);

        console.log(`\n📌 TRANSAÇÃO ${index + 1}:`);
        console.log(`   Mercado Pago ID: ${txid.substring(0, 20)}...`);
        console.log(`   Valor total: R$ ${totalAmount.toFixed(2)}`);
        console.log(`   Números comprados: ${orders.length}`);
        console.log(`   Data/hora: ${new Date(orders[0].paid_at || orders[0].created_at).toLocaleString('pt-BR')}`);
        console.log(`\n   Números:`);
        orders.forEach(o => {
            const num = String(o.number).padStart(3, '0');
            console.log(`      ${num} - R$ ${o.amount}`);
        });
    });

    console.log('\n' + '='.repeat(70));
    console.log(`\n📊 RESUMO:`);
    console.log(`   ${numTransactions === 1 ? '✅ TODOS na MESMA transação' : `⚠️  Foram ${numTransactions} transações SEPARADAS`}`);
    console.log(`   Total de números: ${result.rows.length}`);
    console.log(`   Total pago: R$ ${result.rows.reduce((sum, o) => sum + parseFloat(o.amount), 0).toFixed(2)}\n`);
}

checkTransactions()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('❌ Erro:', err);
        process.exit(1);
    });
