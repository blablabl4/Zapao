const { MercadoPagoConfig, Payment } = require('mercadopago');

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
if (!ACCESS_TOKEN) process.exit(1);

const client = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN });
const payment = new Payment(client);

const orphanedIds = [
    '139445586859',
    '139437424777',
    '139434567021',
    '139433693097'
];

async function fetchDetails() {
    console.log('--- Fetching Details for Orphans ---');

    for (const id of orphanedIds) {
        try {
            const p = await payment.get({ id });

            // Try to find name in various places
            let name = 'N/A';
            let email = p.payer.email || 'N/A';

            if (p.payer.first_name) {
                name = `${p.payer.first_name} ${p.payer.last_name || ''}`.trim();
            } else if (p.additional_info && p.additional_info.payer && p.additional_info.payer.first_name) {
                name = `${p.additional_info.payer.first_name} ${p.additional_info.payer.last_name || ''}`.trim();
            }

            // Identification
            const doc = p.payer.identification ? `${p.payer.identification.type} ${p.payer.identification.number}` : 'N/A';

            console.log(`\nID: ${id}`);
            console.log(`Name: ${name}`);
            console.log(`Email: ${email}`);
            console.log(`Doc: ${doc}`);
            console.log(`Amount: ${p.transaction_amount}`);
            console.log(`Date: ${p.date_approved}`);

        } catch (e) {
            console.error(`Error fetching ${id}:`, e.message);
        }
    }
}

fetchDetails();
