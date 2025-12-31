const { MercadoPagoConfig, Payment } = require('mercadopago');
const { query } = require('./src/database/db');

// Setup MP
const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
if (!ACCESS_TOKEN) process.exit(1);

const client = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN });
const payment = new Payment(client);

async function fullAudit() {
    console.log('🚀 INICIANDO AUDITORIA COMPLETA (JOGOS 1-4)...\n');

    try {
        // --- STEP 1: DB STATUS ---
        console.log('📊 STATUS ATUAL DO BANCO DE DADOS:');
        const rounds = [1, 2, 3, 4];

        for (const r of rounds) {
            const res = await query(`
                SELECT count(*) as total, string_agg(number::text, ', ' ORDER BY number) as nums 
                FROM az_tickets 
                WHERE round_number = $1 AND status = 'ASSIGNED'
            `, [r]);

            const total = res.rows[0].total;
            const nums = res.rows[0].nums || 'Nenhum';
            console.log(`\n🏆 JOGO ${r}: ${total} Cotas Vendidas`);
            // console.log(`   Números: ${nums}`); // Too spammy? Maybe show if requested.
        }

        // --- STEP 2: RECONCILIATION ---
        const LIMIT = 500;
        console.log(`\n🔍 VERIFICANDO DIVERGÊNCIAS (Últimas ${LIMIT} Transações MP)...`);

        const history = await payment.search({
            options: { limit: LIMIT, sort: 'date_created', criteria: 'desc' }
        });

        const mpPayments = history.results || [];
        const approved = mpPayments.filter(p => p.status === 'approved');
        console.log(`Processando ${approved.length} pagamentos aprovados...`);

        let orphans = [];
        let errors = 0;

        for (const p of approved) {
            // Check matches in DB
            const res = await query('SELECT id FROM az_claims WHERE payment_id = $1', [p.id.toString()]);

            if (res.rows.length === 0) {
                // Potential Orphan
                // Filter description to verify it's related to Bolao
                // (Assuming user might have other sales, but description usually contains "Bolao")
                if (p.description && p.description.toLowerCase().includes('bolao')) {
                    orphans.push({
                        id: p.id,
                        date: p.date_approved,
                        amount: p.transaction_amount,
                        email: p.payer.email,
                        desc: p.description
                    });
                }
            }
        }

        if (orphans.length === 0) {
            console.log('\n✅ NENHUMA NOVA DIVERGÊNCIA ENCONTRADA!');
            console.log('Todos os pagamentos do Mercado Pago constam no Banco de Dados.');
        } else {
            console.log(`\n⚠️  ATENÇÃO: ${orphans.length} PAGAMENTOS SEM COTA (ÓRFÃOS):`);
            orphans.forEach(o => {
                console.log(`[${o.date}] ID: ${o.id} | R$ ${o.amount} | ${o.desc}`);
            });
        }

    } catch (e) {
        console.error('CRITICAL ERROR:', e);
    }
}

fullAudit();
