const { query } = require('./src/database/db');

async function inspectC23() {
    console.log('--- INSPECTING HIDDEN CAMPAIGN 23 ---');
    try {
        // 1. Get Campaign Info
        const info = await query("SELECT * FROM az_campaigns WHERE id=23");

        // 2. Get Sample Buyers from C23
        const buyers = await query(`
            SELECT id, name, phone, status, total_qty, claimed_at as created_at
            FROM az_claims 
            WHERE campaign_id=23 AND status='PAID' 
            ORDER BY claimed_at DESC 
            LIMIT 5
        `);

        // Plain text output
        const c = info.rows[0];
        console.log(`\nCAMPAIGN DET: ID=${c.id} | Title=${c.title} | Price=${c.price} | Status=${c.status}`);

        console.log("\nSAMPLE BUYERS:");
        buyers.rows.forEach(b => {
            console.log(`- [${b.id}] ${b.name} (${b.phone}) | Qty: ${b.total_qty} | Time: ${new Date(b.created_at).toLocaleString()}`);
        });

        // 3. Count Total Money in C23
        // Assuming we rely on fixed price or column price
        const total = await query("SELECT sum(total_qty) as qty, count(*) as tx FROM az_claims WHERE campaign_id=23 AND status='PAID'");
        console.log(`\nC23 Totals: ${total.rows[0].qty} Items Sold in ${total.rows[0].tx} Transactions.`);

    } catch (e) {
        console.error(e);
    }
}
inspectC23();
