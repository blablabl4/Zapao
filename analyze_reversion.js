const { query } = require('./src/database/db');

async function analyze() {
    console.log('--- Analyzing for Reversion ---');
    try {
        // 1. Round 1 Composition
        // We expect some REDIST_R1 (Orphans) and some BOLAO (Displaced R5)
        const r1 = await query(`
            SELECT type, min(id) as min_id, max(id) as max_id, count(*) 
            FROM az_claims 
            WHERE round_number=1 
            GROUP BY type
        `);
        console.log('Round 1 Claims:');
        console.table(r1.rows);

        // 2. Round 5 Composition
        // We merged R6 here. R6 claims should have higher IDs.
        // Let's see the ID spread.
        const r5 = await query(`
            SELECT min(id) as min_id, max(id) as max_id, count(*) 
            FROM az_claims 
            WHERE round_number=5
        `);
        console.log('Round 5 Claims (Includes R5 + R6):');
        console.table(r5.rows);

        // Get R5 claims detail to spot the gap/break point
        const r5List = await query("SELECT id, name, created_at FROM az_claims WHERE round_number=5 ORDER BY id ASC");
        // We'll print head and tail
        const len = r5List.rows.length;
        if (len > 0) {
            console.log('Oldest R5:', r5List.rows[0]);
            console.log('Newest R5 (likely R6):', r5List.rows[len - 1]);
        }

    } catch (e) {
        console.error(e);
    }
}
analyze();
