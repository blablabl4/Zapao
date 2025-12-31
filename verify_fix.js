const { MercadoPagoConfig, Payment } = require('mercadopago');

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
if (!ACCESS_TOKEN) process.exit(1);

const client = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN });
const payment = new Payment(client);

async function verifyFix() {
    console.log('--- Verifying Expiration Time on Latest Payment ---');
    try {
        const history = await payment.search({
            options: { limit: 1, sort: 'date_created', criteria: 'desc' }
        });

        if (history.results.length === 0) {
            console.log('No payments found.');
            return;
        }

        const p = history.results[0];
        const created = new Date(p.date_created);
        const expires = new Date(p.date_of_expiration);

        const diffMs = expires - created;
        const diffMinutes = diffMs / 1000 / 60;

        console.log(`Latest Payment ID: ${p.id}`);
        console.log(`Created: ${p.date_created}`);
        console.log(`Expires: ${p.date_of_expiration}`);
        console.log(`Window Size: ${diffMinutes.toFixed(2)} minutes`);

        if (diffMinutes > 10) {
            console.log('✅ SUCCESS: 15-minute fix is ACTIVE!');
        } else {
            console.log('❌ FAIL: Still showing short window (~5 min).');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

verifyFix();
