const { query } = require('./src/database/db');

async function checkStatus() {
    console.log('--- Checking Rounds Status ---');
    try {
        // Round 5
        const r5 = await query("SELECT status, count(*) FROM az_tickets WHERE round_number=5 GROUP BY status");
        console.log('\n[Round 5]');
        console.table(r5.rows);

        // Round 6
        const r6 = await query("SELECT status, count(*) FROM az_tickets WHERE round_number=6 GROUP BY status");
        console.log('\n[Round 6]');
        console.table(r6.rows);

        // Round 7
        const r7 = await query("SELECT status, count(*) FROM az_tickets WHERE round_number=7 GROUP BY status");
        console.log('\n[Round 7]');
        console.table(r7.rows);

        // Count Orphans Remaining (Approximation)
        // We can't easily count "remaining orphans" without re-running the MP search, 
        // but we can check the last output logs or just explain the logic.

    } catch (e) {
        console.error(e);
    }
}

checkStatus();
