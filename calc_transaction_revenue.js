const { query } = require('./src/database/db');

async function calcTrans() {
    console.log('--- Revenue from Finished Transactions (PAID Claims) ---');
    const CAMPAIGN_ID = 21;
    const PRICE = 20.00;

    try {
        const res = await query(`
            SELECT 
                count(*) as total_transactions,
                sum(total_qty) as total_tickets_paid
            FROM az_claims
            WHERE campaign_id=$1 AND status='PAID'
        `, [CAMPAIGN_ID]);

        const txCount = parseInt(res.rows[0].total_transactions);
        const ticketsPaid = parseInt(res.rows[0].total_tickets_paid);
        const totalRev = ticketsPaid * PRICE;

        console.log(`\n📊 TRANSAÇÕES FINALIZADAS (ID de Pagamento):`);
        console.log(`- Qtd. de Pagamentos (IDs únicos): ${txCount}`);
        console.log(`- Qtd. de Cotas Pagas: ${ticketsPaid}`);
        console.log(`- Valor Unitário: R$ ${PRICE.toFixed(2)}`);
        console.log(`- ARRECADAÇÃO TOTAL: R$ ${totalRev.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

        if (ticketsPaid === 458) {
            console.log('\n✅ Bate exato com o nº de cotas vendidas (458).');
        } else {
            console.log(`\n⚠️ Diferença encontrada: Cotas vendidas (Tickets) = 458 vs Pagas (Claims) = ${ticketsPaid}`);
        }

    } catch (e) {
        console.error(e);
    }
}
calcTrans();
