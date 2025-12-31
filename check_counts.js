const { query } = require('./src/database/db');

async function checkCounts() {
    console.log('--- Checking Database Counts ---');
    try {
        // 1. Check Round 1 Ticket Status
        console.log('\n[Round 1] Ticket Status:');
        const r1Res = await query(`
            SELECT status, count(*) 
            FROM az_tickets 
            WHERE round_number = 1 
            GROUP BY status
        `);
        if (r1Res.rows.length === 0) console.log('No tickets found for Round 1.');
        else console.table(r1Res.rows);

        // 2. Check Today's Sales (Since 19:00)
        console.log('\n[Today] Sales Analysis (Since 19:00):');
        const todayRes = await query(`
            SELECT 
                count(*) as total_payments, 
                sum(total_qty) as total_tickets,
                sum(CASE WHEN total_qty > 1 THEN 1 ELSE 0 END) as multi_ticket_orders
            FROM az_claims 
            WHERE claimed_at >= '2025-12-30T19:00:00.000Z' 
            AND status = 'PAID'
        `);
        console.table(todayRes.rows);

    } catch (e) {
        console.error('ERROR:', e.message);
    }
}

checkCounts();
