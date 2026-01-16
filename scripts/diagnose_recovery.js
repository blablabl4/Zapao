const { query } = require('../src/database/db');

async function diagnose() {
    try {
        console.log('=== DIAGNOSTIC START ===');

        // 1. Get recent draws (last 5 ids)
        const recentDraws = await query('SELECT id, draw_name, status, sales_locked, winners_count, created_at, closed_at FROM draws ORDER BY id DESC LIMIT 5');
        console.log('Recent Draws:', JSON.stringify(recentDraws.rows, null, 2));

        // 2. Check for "Force Test" draw specifically
        const testDraws = await query("SELECT * FROM draws WHERE draw_name LIKE '%RASPADINHA%' OR draw_name LIKE '%TESTE%'");
        console.log('Test Draws Found:', JSON.stringify(testDraws.rows, null, 2));

        // 3. Check for Tables
        try {
            await query('SELECT count(*) FROM scratchcards');
            console.log('Table scratchcards: EXISTS');
        } catch (e) {
            console.log('Table scratchcards: MISSING (' + e.code + ')');
        }

        console.log('=== DIAGNOSTIC END ===');
        process.exit(0);
    } catch (e) {
        console.error('Fatal Error:', e);
        process.exit(1);
    }
}

diagnose();
