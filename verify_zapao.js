const OrderService = require('./src/services/OrderService');
const PaymentService = require('./src/services/PaymentService');
const DrawService = require('./src/services/DrawService');

async function testFlow() {
    console.log('--- TESTANDO FLUXO ZAPÃO (LOG: az_logs) ---');

    // 1. Get Current Draw
    const draw = await DrawService.getCurrentDraw();
    console.log(`Rodada Atual: ID ${draw.id}`);

    // 2. Buy Number 01 (Isaque Teste)
    try {
        const order = await OrderService.createOrder(1, 'Isaque Teste|11999999999', draw.id);
        console.log(`Pedido Criado: ${order.order_id} (R$ ${order.amount})`);

        // 3. Simulate Webhook
        const webhookPayload = {
            order_id: order.order_id,
            amount_paid: 1.50,
            provider: 'MOCK_TEST',
            txid: 'TX_123456789'
        };

        const result = await PaymentService.processWebhook(webhookPayload);
        console.log('Webhook Processado:', result);

        // 4. Verify Final Status
        const finalOrder = await OrderService.getOrder(order.order_id);
        console.log(`Status Final do Pedido: ${finalOrder.status} (Esperado: PAID)`);

        if (finalOrder.status === 'PAID') {
            console.log('✅ TESTE SUCESSO!');
        } else {
            console.error('❌ TESTE FALHOU');
        }

    } catch (e) {
        console.error('❌ ERRO NO TESTE:', e.message);
    }
    process.exit(0);
}

testFlow();
