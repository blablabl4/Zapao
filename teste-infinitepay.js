/**
 * Script para testar InfinitePay - Gera um link de pagamento de teste
 * Execute: node teste-infinitepay.js
 */

async function testarInfinitePay() {
    const handle = 'tvzapao'; // Sua InfiniteTag
    const amount = 100; // R$ 1,00 em centavos
    const description = 'Teste TVZapão - Terminal';
    const orderNsu = `teste-${Date.now()}`;

    console.log('\n🧪 TESTE INFINITEPAY');
    console.log('==================');
    console.log(`Handle: ${handle}`);
    console.log(`Valor: R$ ${(amount / 100).toFixed(2)}`);
    console.log(`Order NSU: ${orderNsu}`);
    console.log('');

    const payload = {
        handle: handle,
        items: [
            {
                quantity: 1,
                price: amount,
                description: description
            }
        ],
        order_nsu: orderNsu,
        webhook_url: 'https://www.tvzapao.com.br/api/webhooks/infinitepay',
        redirect_url: 'https://www.tvzapao.com.br/payment-success'
    };

    console.log('📦 Payload:');
    console.log(JSON.stringify(payload, null, 2));
    console.log('');
    console.log('🚀 Enviando requisição...');

    try {
        const response = await fetch('https://api.infinitepay.io/invoices/public/checkout/links', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();

        console.log(`\n📡 Status: ${response.status} ${response.statusText}`);

        if (response.ok) {
            const data = JSON.parse(responseText);
            console.log('\n✅ SUCESSO! Link de pagamento gerado:');
            console.log('========================================');
            console.log(`🔗 ${data.checkout_url}`);
            console.log('========================================');
            console.log('\n📋 Resposta completa:');
            console.log(JSON.stringify(data, null, 2));
            console.log('\n💡 Acesse o link acima para pagar R$ 1,00 via Pix');
        } else {
            console.log('\n❌ ERRO:');
            console.log(responseText);
        }
    } catch (error) {
        console.error('\n❌ Erro na requisição:', error.message);
    }
}

testarInfinitePay();
