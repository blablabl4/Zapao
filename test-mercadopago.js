/**
 * Teste simples da API do Mercado Pago
 * Verifica se as credenciais funcionam
 */
require('dotenv').config();
const mercadopago = require('mercadopago');

async function testMercadoPago() {
    const accessToken = process.env.MP_ACCESS_TOKEN || 'APP_USR-8257237803237512-121815-1ae5b68763825835f2073df131642d87-1287524127';

    console.log('🧪 Testando Mercado Pago API...');
    console.log('Token:', accessToken.substring(0, 20) + '...');

    try {
        // Configurar SDK
        mercadopago.configure({
            access_token: accessToken
        });

        console.log('✅ SDK configurado');

        // Criar pagamento de teste
        const paymentData = {
            transaction_amount: 1.00,
            description: 'Teste TVZapão',
            payment_method_id: 'pix',
            external_reference: 'test_' + Date.now(),
            payer: {
                email: 'test@tvzapao.com.br',
                first_name: 'Teste',
                last_name: 'MP'
            }
        };

        console.log('📝 Criando pagamento Pix de R$ 1,00...');

        const response = await mercadopago.payment.create(paymentData);

        console.log('✅ SUCESSO! Pagamento criado:');
        console.log('   Payment ID:', response.body.id);
        console.log('   Status:', response.body.status);
        console.log('   QR Code disponível:', !!response.body.point_of_interaction);

        if (response.body.point_of_interaction) {
            const txData = response.body.point_of_interaction.transaction_data;
            console.log('   📱 QR Code Base64:', txData.qr_code_base64 ? 'SIM' : 'NÃO');
            console.log('   📋 Pix Copia e Cola:', txData.qr_code ? txData.qr_code.substring(0, 50) + '...' : 'NÃO');
        }

        return true;

    } catch (error) {
        console.error('❌ ERRO ao criar pagamento:');
        console.error('   Message:', error.message);
        console.error('   Status:', error.status);
        console.error('   Cause:', error.cause);

        if (error.cause && error.cause.length > 0) {
            console.error('   Detalhes:', JSON.stringify(error.cause, null, 2));
        }

        return false;
    }
}

// Executa teste
testMercadoPago()
    .then(success => {
        if (success) {
            console.log('\n🎉 API do Mercado Pago está funcionando!');
            process.exit(0);
        } else {
            console.log('\n⚠️  Verifique as credenciais e tente novamente');
            process.exit(1);
        }
    })
    .catch(err => {
        console.error('\n💥 Erro inesperado:', err);
        process.exit(1);
    });
