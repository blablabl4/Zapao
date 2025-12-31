const { MercadoPagoConfig, Payment } = require('mercadopago');
const { query } = require('./src/database/db');

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
if (!ACCESS_TOKEN) process.exit(1);

const client = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN });
const payment = new Payment(client);

// Window: Today 00:00 -> First R2 Sale (23:04 Z)
const START_TIME = '2025-12-30T00:00:00Z';
const END_TIME = '2025-12-30T23:04:53.350Z';

async function findEarly() {
    console.log(`--- Searching Early Payments (${START_TIME} -> ${END_TIME}) ---`);
    console.log('Criteria: Approved AND Amount >= 20.00');

    try {
        const history = await payment.search({
            options: {
                sort: 'date_created',
                criteria: 'asc',
                range: 'date_created',
                begin_date: START_TIME,
                end_date: END_TIME,
                status: 'approved',
                limit: 100
            }
        });

        const results = history.results || [];
        console.log(`\nFound ${results.length} payments in time range.`);

        let orphans = 0;
        let valid = 0;

        for (const p of results) {
            if (p.transaction_amount < 20) {
                // Ignore small test amounts
                continue;
            }

            // Check DB
            const pid = p.id.toString();
            const start = Date.now();
            const check = await query("SELECT id, round_number, status FROM az_claims WHERE payment_id = $1", [pid]);

            if (check.rows.length === 0) {
                console.log(`\n🚨 ORPHAN (Loss): ID ${pid} | R$ ${p.transaction_amount} | ${p.description}`);
                orphans++;
            } else {
                const claim = check.rows[0];
                console.log(`   OK: ID ${pid} -> Round ${claim.round_number} (${claim.status})`);
                valid++;
            }
        }

        console.log(`\nSummary: ${valid} Valid (In DB), ${orphans} Orphans (Need Fix).`);

    } catch (e) {
        console.error('ERROR:', e);
    }
}

findEarly();
