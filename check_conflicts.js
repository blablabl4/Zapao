const { query } = require('./src/database/db');

async function checkConflicts() {
    console.log('--- Checking Ticket Conflicts (R1 vs R5 vs R6) ---');
    try {
        // 1. Get assigned numbers in R1
        const r1 = await query("SELECT number FROM az_tickets WHERE round_number=1 AND status='ASSIGNED'");
        const r1Nums = r1.rows.map(r => r.number);
        console.log(`Round 1 Assigned: ${r1Nums.length} (Min: ${Math.min(...r1Nums)}, Max: ${Math.max(...r1Nums)})`);

        // 2. Get assigned numbers in R5
        const r5 = await query("SELECT number FROM az_tickets WHERE round_number=5 AND status='ASSIGNED'");
        const r5Nums = r5.rows.map(r => r.number);
        console.log(`Round 5 Assigned: ${r5Nums.length} (Min: ${Math.min(...r5Nums)}, Max: ${Math.max(...r5Nums)})`);

        // 3. Get assigned numbers in R6
        const r6 = await query("SELECT number FROM az_tickets WHERE round_number=6 AND status='ASSIGNED'");
        const r6Nums = r6.rows.map(r => r.number);
        console.log(`Round 6 Assigned: ${r6Nums.length} (Min: ${Math.min(...r6Nums)}, Max: ${Math.max(...r6Nums)})`);

        // 4. Calculate Conflicts (R5 moving to R1)
        const conflictR5toR1 = r5Nums.filter(n => r1Nums.includes(n));
        console.log(`\nConflict R5 -> R1: ${conflictR5toR1.length} ticket numbers overlap.`);

        // 5. Calculate Conflicts (R6 moving to R5)
        // R5 will be empty after move, so no conflict with *old* R5, but we check just in case logic fails.
        // Actually, if we move R5 out, R5 is empty. Then we move R6 in. R6 numbers generally are 1-100 too.
        // So R6 moving to R5 is fine IF R5 is cleared.

    } catch (e) {
        console.error(e);
    }
}
checkConflicts();
