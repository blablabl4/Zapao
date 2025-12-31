const { query } = require('./src/database/db');

async function auditMoney() {
    console.log('--- AUDIT: Money vs Tickets ---');
    const CAMPAIGN_ID = 21;
    const PRICE = 20.00;

    try {
        // 1. Total Money Received (sum of total_qty * price)
        const moneyRes = await query(`
            SELECT sum(total_qty) as total_qty, count(distinct id) as total_people
            FROM az_claims 
            WHERE campaign_id=$1 AND status='PAID'
        `, [CAMPAIGN_ID]);

        const paidQty = parseInt(moneyRes.rows[0].total_qty || 0);
        const people = parseInt(moneyRes.rows[0].total_people || 0);
        const revenue = paidQty * PRICE;

        console.log(`💰 MONEY SIDE:`);
        console.log(`- Paid Transactions: ${people}`);
        console.log(`- Total Quotas Paid For: ${paidQty}`);
        console.log(`- Total Revenue (Calculated): R$ ${revenue.toFixed(2)}`);

        // 2. Total Tickets Existent (Assigned)
        const ticketRes = await query(`
            SELECT count(*) as cnt 
            FROM az_tickets 
            WHERE campaign_id=$1 AND status='ASSIGNED'
        `, [CAMPAIGN_ID]);

        const assignedTickets = parseInt(ticketRes.rows[0].cnt || 0);
        const ticketValue = assignedTickets * PRICE;

        console.log(`\n🎫 TICKET SIDE:`);
        console.log(`- Assigned Tickets in DB: ${assignedTickets}`);
        console.log(`- Value of Tickets: R$ ${ticketValue.toFixed(2)}`);

        console.log('\n--- BALANCE ---');
        const diff = paidQty - assignedTickets;
        if (diff === 0) {
            console.log(`✅ PERFECT BALANCE. Every cent has a ticket.`);
        } else if (diff > 0) {
            console.log(`⚠️ ALARM: We have payment for ${diff} quotas that are NOT assigned tickets! (Money > Tickets)`);

            // List the ghosts
            const ghosts = await query(`
                SELECT c.id, c.name, c.total_qty, count(t.id) as tickets
                FROM az_claims c
                LEFT JOIN az_tickets t ON t.assigned_claim_id = c.id
                WHERE c.campaign_id=$1 AND c.status='PAID'
                GROUP BY c.id
                HAVING count(t.id) < c.total_qty
            `, [CAMPAIGN_ID]);
            console.table(ghosts.rows);

        } else {
            console.log(`⚠️ WEIRD: We have ${Math.abs(diff)} tickets assigned without payment! (Tickets > Money)`);
        }

    } catch (e) {
        console.error(e);
    }
}
auditMoney();
