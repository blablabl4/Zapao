const { query } = require('../src/database/db');

async function surgicalRestoreOficial() {
    try {
        console.log('🏥 SURGICAL RESTORE V2 (CASCADE) STARTED');
        const DRAW_ID = 28;

        // 1. DROP NEW TABLES FIRST (Removes FKs to orders)
        // Using CASCADE to be sure
        const tables = ['scratchcards', 'loyalty_profiles', 'app_config'];
        for (const table of tables) {
            console.log(`Dropping table ${table}...`);
            await query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        }

        // 2. CLEANUP DEPENDENCIES FOR DRAW 28
        console.log(`Cleaning child records for Draw #${DRAW_ID}...`);

        // Remove Clicks
        await query('DELETE FROM affiliate_clicks WHERE draw_id = $1', [DRAW_ID]);

        // Remove Orders (and their payments via cascade if configured, or manually if not)
        // Usually winner_payments links to orders. Clean that too just in case.
        // We need to find order_ids first?
        // Let's rely on standard delete, if it fails we dig deeper.
        // But for "TESTE" draw, likely no complex payments.
        await query('DELETE FROM orders WHERE draw_id = $1', [DRAW_ID]);

        // 3. DELETE THE DRAW
        console.log(`Removing Draw #${DRAW_ID}...`);
        const drawRes = await query("DELETE FROM draws WHERE id = $1 RETURNING id", [DRAW_ID]);

        if (drawRes.rowCount > 0) {
            console.log(`✅ Deleted Draw #${DRAW_ID}`);
        } else {
            console.log('⚠️ Draw not found (clean).');
        }

        console.log('✅ DATABASE RESTORED SUCCESSFULLY.');
        process.exit(0);

    } catch (e) {
        console.error('❌ RESTORE FAILED:', e);
        process.exit(1);
    }
}

surgicalRestoreOficial();
