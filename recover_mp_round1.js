const { MercadoPagoConfig, Payment } = require('mercadopago');

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
if (!ACCESS_TOKEN) process.exit(1);

const client = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN });
const payment = new Payment(client);

async function recoverRound1() {
    console.log('--- Searching MP for Round 1 (Dec 18 - Dec 25) ---');
    try {
        const filters = {
            sort: 'date_created',
            criteria: 'desc',
            range: 'date_created',
            begin_date: '2025-12-18T00:00:00Z',
            end_date: '2025-12-25T23:59:59Z',
            status: 'approved',
            limit: 100 // Fetch up to 100 to see what we find
        };

        const history = await payment.search({ options: filters });
        const results = history.results || [];

        console.log(`Found ${results.length} approved payments in range.`);

        const matches = results.map(p => {
            const payer = p.payer || {};
            const name = payer.first_name ? `${payer.first_name} ${payer.last_name || ''}` : (payer.email || 'Desconhecido');
            return {
                id: p.id,
                created: new Date(p.date_created).toLocaleString('pt-BR'),
                amount: p.transaction_amount,
                desc: p.description,
                payer: name.trim(),
                email: payer.email
            };
        });

        console.log('\n--- EXTRATO RECUPERADO ---');
        matches.forEach(m => {
            console.log(`DATA: ${m.created} | NOME: ${m.payer} | VALOR: ${m.amount} | DESC: ${m.desc}`);
            console.log('---------------------------------------------------');
        });

    } catch (e) {
        console.error('Error:', e);
    }
}

recoverRound1();
