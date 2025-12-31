const { MercadoPagoConfig, Payment } = require('mercadopago');
const { query } = require('./src/database/db');

// Setup MP Creds
const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
if (!ACCESS_TOKEN) process.exit(1);

const client = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN });
const payment = new Payment(client);

async function reconcile() {
    console.log('--- FULL RECONCILIATION (All December Payments) ---');
    try {
        // Fetch up to 1000 payments from December
        const history = await payment.search({
            options: {
                limit: 1000,
                sort: 'date_created',
                criteria: 'desc',
                begin_date: '2025-12-01T00:00:00Z',
                end_date: '2025-12-31T23:59:59Z'
            }
        });

        const mpPayments = history.results || [];
        console.log(`Fetched ${mpPayments.length} payments from Mercado Pago (December).`);

        const approved = mpPayments.filter(p => p.status === 'approved');
        console.log(`Found ${approved.length} APPROVED payments.`);

        let orphaned = [];
        let totalMPRevenue = 0;
        let totalOrphanMoney = 0;

        for (const p of approved) {
            totalMPRevenue += p.transaction_amount;

            const res = await query('SELECT id, status FROM az_claims WHERE payment_id = $1', [p.id.toString()]);

            if (res.rows.length === 0) {
                // ORPHAN FOUND
                totalOrphanMoney += p.transaction_amount;
                orphaned.push({
                    id: p.id,
                    date: p.date_approved,
                    amount: p.transaction_amount,
                    email: p.payer?.email || 'N/A',
                    name: ((p.payer?.first_name || '') + ' ' + (p.payer?.last_name || '')).trim() || 'N/A',
                    cpf: p.payer?.identification?.number || 'N/A',
                    desc: p.description
                });
            }
        }

        console.log(`\n--- FINANCIAL SUMMARY ---`);
        console.log(`Total MP Revenue (Approved): R$ ${totalMPRevenue.toFixed(2)}`);
        console.log(`Orphaned Money (Not in DB): R$ ${totalOrphanMoney.toFixed(2)}`);
        console.log(`Tracked in DB: R$ ${(totalMPRevenue - totalOrphanMoney).toFixed(2)}`);

        console.log(`\n--- ORPHANED PAYMENTS (${orphaned.length}) ---`);
        orphaned.forEach(o => {
            console.log(`[${o.id}] ${o.date} | R$ ${o.amount} | ${o.name} | ${o.email}`);
        });

        console.log(`\n--- END ---`);

    } catch (e) {
        console.error('Error:', e);
    }
}

reconcile();
