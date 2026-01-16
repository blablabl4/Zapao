const { query } = require('../src/database/db');

async function surgicalRestore() {
    try {
        console.log('🏥 SURGICAL RESTORE STARTED');

        // 1. Delete Corrupt Draw 28
        console.log('Removing Draw #28 (TESTE)...');
        const drawRes = await query("DELETE FROM draws WHERE id = 28 RETURNING id, draw_name");
        if (drawRes.rowCount > 0) {
            console.log(`✅ Deleted Draw #${drawRes.rows[0].id}: ${drawRes.rows[0].draw_name}`);
        } else {
            console.log('⚠️ Draw #28 not found (already deleted?)');
        }

        // 2. Drop "Alien" Tables (from skipped migrations)
        const tables = ['scratchcards', 'loyalty_profiles', 'app_config'];
        for (const table of tables) {
            console.log(`Dropping table ${table}...`);
            await query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        }

        console.log('✅ CLEANUP COMPLETE. System restored to Checkpoint 17 state.');
        process.exit(0);

    } catch (e) {
        console.error('❌ FATAL ERROR:', e);
        process.exit(1);
    }
}

surgicalRestore();
