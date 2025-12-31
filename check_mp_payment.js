const { MercadoPagoConfig, Payment } = require('mercadopago');

// Setup MP Creds
const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
    console.error("Missing MP_ACCESS_TOKEN");
    process.exit(1);
}

// v2+ Configuration
const client = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN });
const payment = new Payment(client);

async function checkPayment() {
    const paymentId = '139445586859';
    console.log(`Checking Payment ID: ${paymentId}...`);

    try {
        const p = await payment.get({ id: paymentId });

        console.log('--- Payment Found ---');
        console.log(`Status: ${p.status}`);
        console.log(`Status Detail: ${p.status_detail}`);
        console.log(`Date Approved: ${p.date_approved}`);
        console.log(`Amount: ${p.transaction_amount}`);
        console.log(`Description: ${p.description}`);
        console.log(`External Ref: ${p.external_reference}`);
        console.log(`Payer Email: ${p.payer.email}`);

        if (p.metadata) {
            console.log('Metadata:', JSON.stringify(p.metadata, null, 2));
        }

    } catch (e) {
        console.error('Error fetching payment:', e.message);
        if (e.cause) console.error(JSON.stringify(e.cause, null, 2));
    }
}

checkPayment();
