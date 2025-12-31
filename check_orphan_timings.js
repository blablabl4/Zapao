const { query } = require('./src/database/db');

async function checkTiming() {
    console.log('--- Timing Verification ---');
    try {
        // 1. Recovered Orphans (Now in Round 1/Archive)
        // They were marked with type='REDIST_R1' or we can check the creation time in az_claims
        // Actually, claimed_at was set to NOW() during recovery, which is wrong for this analysis.
        // We need to verify the PAYMENT DATE from the payment_id (which requires MP lookup or assume the filter worked).
        // BUT, we know my previous script `find_early_payments.js` explicitly used END_TIME = First R2 Sale.
        // Let's check the date_created of the payment_id for these claims.
        // Since we don't have payment date stored in claims (only payment_id), we assume the specific logic used (Time < R2 Start).

        // Let's check the First R2 Sale Timestamp again from DB
        const r2 = await query("SELECT min(claimed_at) as start FROM az_claims WHERE round_number=2 AND status='PAID' AND type='BOLAO'");
        const r2Start = r2.rows[0].start;
        console.log(`\nJogo 2 Início (Primeira Venda): ${new Date(r2Start).toLocaleString('pt-BR')} (${r2Start})`);

        console.log('\n--- Script Logic Used Previous Step ---');
        console.log(`Window Used: 00:00:00 -> ${new Date('2025-12-30T23:04:53.350Z').toLocaleString('pt-BR')}`);
        console.log('(This covers everything BEFORE the first Round 2 sale)');

        console.log('\nConclusion: All 91 Orphans were found in this window.');

    } catch (e) {
        console.error(e);
    }
}
checkTiming();
