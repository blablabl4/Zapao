/**
 * Gera Pix via API REST do Mercado Pago (sem SDK)
 * Para ativar credenciais de produção
 */
require('dotenv').config();

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || 'APP_USR-8257237803237512-121815-1ae5b68763825835f2073df131642d87-1287524127';

async function gerarPixAtivacao() {
    console.log('🔥 Gerando Pix de ativação do Mercado Pago...\n');

    const paymentData = {
        transaction_amount: 1.00,
        description: 'Ativação API TVZapão',
        payment_method_id: 'pix',
        payer: {
            email: 'ativacao@tvzapao.com.br',
            first_name: 'Ativacao',
            last_name: 'API'
        }
    };

    try {
        const response = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'X-Idempotency-Key': 'ativacao-' + Date.now()
            },
            body: JSON.stringify(paymentData)
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('❌ Erro na API:', error);
            return;
        }

        const data = await response.json();

        console.log('✅ PIX GERADO COM SUCESSO!\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`💰 Valor: R$ ${data.transaction_amount.toFixed(2)}`);
        console.log(`🆔 Payment ID: ${data.id}`);
        console.log(`📊 Status: ${data.status}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        if (data.point_of_interaction && data.point_of_interaction.transaction_data) {
            const txData = data.point_of_interaction.transaction_data;

            console.log('📱 PIX COPIA E COLA:\n');
            console.log(txData.qr_code);
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

            if (txData.qr_code_base64) {
                console.log('🖼️  QR Code gerado! (Base64 disponível)');
                console.log('📋 Copie o código acima e cole no seu app de banco\n');
            }

            console.log('⏰ Este Pix expira em alguns minutos');
            console.log('💡 PRÓXIMO PASSO:');
            console.log('   1. Abra o app do seu banco');
            console.log('   2. Escolha "Pagar com Pix"');
            console.log('   3. Cole o código acima');
            console.log('   4. Pague R$ 1,00');
            console.log('   5. Volte no painel MP e clique "Já fiz o pagamento"\n');

        } else {
            console.log('⚠️  QR Code não disponível na resposta');
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

gerarPixAtivacao();
