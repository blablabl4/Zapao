const { MercadoPagoConfig, Payment } = require('mercadopago');

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
if (!ACCESS_TOKEN) process.exit(1);

const client = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN });
const payment = new Payment(client);

async function checkCancellations() {
    console.log('--- Checking Recent Cancellations (Last 50) ---');
    try {
        const history = await payment.search({
            options: { limit: 50, sort: 'date_created', criteria: 'desc' }
        });

        const recent = history.results || [];
        const bad = recent.filter(p => p.status === 'cancelled' || p.status === 'rejected');

        console.log(`Found ${bad.length} CANCELLED/REJECTED in last 50.`);

        bad.forEach(p => {
            const date = new Date(p.date_created).toLocaleString('pt-BR');
            const exp = p.date_of_expiration ? new Date(p.date_of_expiration).toLocaleString('pt-BR') : 'N/A';
            console.log(`\nID: ${p.id} | Amount: ${p.transaction_amount}`);
            console.log(`   Status: ${p.status} | Detail: ${p.status_detail}`);
            console.log(`   Created: ${date}`);
            console.log(`   Expires: ${exp}`);
            console.log(`   Desc: ${p.description}`);
        });

    } catch (e) {
        console.error('Error:', e);
    }
}

checkCancellations();
