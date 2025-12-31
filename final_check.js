const { query } = require('./src/database/db');

async function finalCheck() {
    console.log('--- Final Check: Revenue & Orphans ---');
    const CAMPAIGN_ID = 21;
    const PRICE = 20.00;

    try {
        // 1. REVENUE (Using fixed price R$ 20.00)
        const tickets = await query("SELECT count(*) FROM az_tickets WHERE campaign_id=$1 AND status='ASSIGNED'", [CAMPAIGN_ID]);
        const count = parseInt(tickets.rows[0].count);
        const total = count * PRICE;

        console.log(`\n💰 FINANCEIRO:`);
        console.log(`- Cotas Vendidas: ${count}`);
        console.log(`- Valor Unitário: R$ ${PRICE.toFixed(2)}`);
        console.log(`- TOTAL ARRECADADO: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

        // 2. ORPHANS (Re-scan)
        // We look for claims in the last hour that might be missing tickets?
        // Or payments in MP? 
        // Let's check "Orphan Tickets" (Assigned but no claim) - we did that.
        // Let's check "Orphan Claims" (PAID but no tickets) - THIS IS THE KEY.

        const orphanClaims = await query(`
            SELECT count(*) 
            FROM az_claims c
            LEFT JOIN az_tickets t ON t.assigned_claim_id = c.id
            WHERE c.campaign_id=$1 AND c.status='PAID' AND c.type='BOLAO' AND t.id IS NULL
        `, [CAMPAIGN_ID]);

        const orphans = parseInt(orphanClaims.rows[0].count);
        console.log(`\n🔍 ÓRFÃOS (Pagou e não levou): ${orphans}`);

        if (orphans === 0) {
            console.log('✅ Tudo Limpo. Não existem órfãos.');
        } else {
            console.log(`⚠️ ALERTA: Existem ${orphans} pagamentos sem cota!`);
        }

    } catch (e) {
        console.error(e);
    }
}
finalCheck();
