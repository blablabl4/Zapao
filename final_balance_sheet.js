const { query } = require('./src/database/db');

async function balanceSheet() {
    console.log('--- Resumo Final (Balanço) ---');
    try {
        // 1. Total Recovered Claims (The ones we moved to Round 1)
        // We marked them with type='REDIST_R1' (or similar logic/timestamp)
        // Actually, in the redistribution script we utilized 'REDIST_R1'.
        const recovered = await query("SELECT count(*) FROM az_claims WHERE type = 'REDIST_R1' OR (round_number=1 AND status='PAID' AND claimed_at > '2025-12-30 12:00:00')");
        // Note: The move_to_r1 script might have kept type REDIST_R1 but strictly speaking we want to count the "Fixed Orphans".

        // Let's count by type REDIST_R1 as that was the tag used.
        const redist = await query("SELECT count(*) FROM az_claims WHERE type = 'REDIST_R1'");

        // 2. Are there any orphan payments left?
        // We'd need to re-scan MP to be 100% sure, but we can rely on the last scan which said "Done".

        // 3. Round 1 Status (Storage)
        const r1 = await query("SELECT status, count(*) FROM az_tickets WHERE round_number=1 GROUP BY status");

        // 4. Round 6 Status (Active Sales)
        const r6 = await query("SELECT status, count(*) FROM az_tickets WHERE round_number=6 GROUP BY status");

        console.log(`\n1. Cotas Recuperadas (Salvas no Jogo 1): ${redist.rows[0].count}`);

        console.log('\n2. Estado do Jogo 1 (Arquivo):');
        console.table(r1.rows);

        console.log('\n3. Estado do Jogo 6 (Vendas Atuais):');
        console.table(r6.rows);

    } catch (e) {
        console.error(e);
    }
}
balanceSheet();
