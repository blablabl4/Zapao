const OrderService = require('./src/services/OrderService');
const DrawService = require('./src/services/DrawService');

async function verifySharedLogic() {
    console.log('--- TESTANDO LOGICA COMPARTILHADA (MULTIPLOS GANHADORES) ---');

    const draw = await DrawService.getCurrentDraw();
    console.log(`Rodada: ${draw.id}`);

    // User A buys Number 10
    const orderA = await OrderService.createOrder(10, 'User A|11999999999', draw.id);
    console.log(`✅ User A comprou num 10: ${orderA.order_id}`);

    // User B buys Number 10 (Should succeed now)
    try {
        const orderB = await OrderService.createOrder(10, 'User B|11888888888', draw.id);
        console.log(`✅ User B comprou num 10: ${orderB.order_id}`);
        console.log('🎉 SUCESSO: O numero 10 foi vendido para duas pessoas diferentes!');
    } catch (e) {
        console.error('❌ FALHA: O bloqueio ainda existe!', e.message);
    }

    process.exit(0);
}

verifySharedLogic();
