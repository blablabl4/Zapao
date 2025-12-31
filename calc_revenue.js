const { query } = require('./src/database/db');

async function calcRevenue() {
    console.log('--- Calculating Total Revenue (Campaign 21) ---');
    const CAMPAIGN_ID = 21;

    try {
        // 1. Get Price
        const camp = await query("SELECT price FROM az_campaigns WHERE id=$1", [CAMPAIGN_ID]);
        const price = parseFloat(camp.rows[0].price);
        console.log(`Ticket Price: R$ ${price.toFixed(2)}`);

        // 2. Get Total Sold (Assigned Tickets)
        // We use tickets count because that's the actual product delivered.
        const tickets = await query("SELECT count(*) FROM az_tickets WHERE campaign_id=$1 AND status='ASSIGNED'", [CAMPAIGN_ID]);
        const count = parseInt(tickets.rows[0].count);
        console.log(`Total Tickets Sold: ${count}`);

        // 3. Calculate Total
        const total = count * price;
        console.log(`\nTOTAL REVENUE: R$ ${total.toFixed(2)}`);

        // 4. Breakdown by Round
        const byRound = await query(`
            SELECT round_number, count(*) as qty, (count(*) * $2) as value
            FROM az_tickets 
            WHERE campaign_id=$1 AND status='ASSIGNED'
            GROUP BY round_number
            ORDER BY round_number
        `, [CAMPAIGN_ID, price]);

        console.table(byRound.rows);

    } catch (e) {
        console.error(e);
    }
}
calcRevenue();
