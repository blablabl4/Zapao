const { MercadoPagoConfig, Payment } = require('mercadopago');
const { query } = require('./src/database/db');

// Setup MP
const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
if (!ACCESS_TOKEN) process.exit(1);

const client = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN });
const payment = new Payment(client);

const orphans = [
    '139445586859',
    '139437424777',
    '139434567021',
    '139433693097'
];

async function checkTargets() {
    console.log('--- Checking Orphan Targets ---\n');

    for (const id of orphans) {
        try {
            // 1. Get MP Data
            const p = await payment.get({ id });
            const desc = p.description || '';
            const match = desc.match(/Nums \[([\d,]+)\]/);
            const numbers = match ? match[1] : 'Unknown';
            const date = new Date(p.date_approved).toLocaleString('pt-BR');
            const amount = p.transaction_amount;

            console.log(`❌ ORFÃO: ID ${id} (${date}) - R$ ${amount}`);
            console.log(`   Tentativa de compra: Cota #${numbers}`);

            // 2. Check who OWNS it now
            if (numbers !== 'Unknown') {
                const numsArray = numbers.split(',').map(n => parseInt(n));
                for (const num of numsArray) {
                    const res = await query(`
                        SELECT c.name, c.phone, c.status, c.payment_id
                        FROM az_tickets t
                        LEFT JOIN az_claims c ON t.assigned_claim_id = c.id
                        WHERE t.round_number = 4 AND t.number = $1
                    `, [num]);

                    if (res.rows.length > 0) {
                        const curr = res.rows[0];
                        console.log(`   ⚠️  DONO ATUAL DA COTA #${num}:`);
                        console.log(`       Nome: ${curr.name}`);
                        console.log(`       Fone: ${curr.phone}`);
                        console.log(`       Status: ${curr.status}`);
                        console.log(`       ID Pgto Atual: ${curr.payment_id}`);
                    } else {
                        console.log(`   ✅ Cota #${num} está LIVRE no sistema (Estranho...)`);
                    }
                }
            } else {
                console.log('   Não consegui ler o número da cota na descrição.');
            }
            console.log('---------------------------------------------------');

        } catch (e) {
            console.error(`Error ${id}:`, e.message);
        }
    }
}

checkTargets();
