const { query } = require('./src/database/db');

async function analyzeR1() {
    console.log('--- Analyze Round 1 Tickets ---');
    try {
        // 1. Min/Max for Round 1
        const r1Range = await query("SELECT min(number), max(number), count(*) FROM az_tickets WHERE round_number=1");
        console.log('Round 1 Range:', r1Range.rows[0]);

        // 2. Max Assigned Number in Round 1
        const r1MaxAssigned = await query("SELECT max(number) FROM az_tickets WHERE round_number=1 AND status='ASSIGNED'");
        console.log('Round 1 Max Assigned:', r1MaxAssigned.rows[0]);

        // 3. Min/Max for Round 2 (Control)
        const r2Range = await query("SELECT min(number), max(number), count(*) FROM az_tickets WHERE round_number=2");
        console.log('Round 2 Range:', r2Range.rows[0]);
    } catch (e) {
        console.error(e);
    }
}
analyzeR1();
