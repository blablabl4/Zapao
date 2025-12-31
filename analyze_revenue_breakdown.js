const { query } = require('./src/database/db');

async function breakdown() {
    console.log('--- REVENUE COMPOSITION SEARCH ---');
    try {
        // 1. Get Campaigns and Prices
        const camps = await query("SELECT id, title, price FROM az_campaigns WHERE id IN (1, 21, 23)");

        console.log("Campaign Details:");
        console.table(camps.rows);

        // 2. Get Sales Volumes (Paid)
        const sales = await query(`
            SELECT campaign_id, count(id) as transactions, sum(total_qty) as qty 
            FROM az_claims 
            WHERE status='PAID' AND claimed_at > '2025-12-01'
            GROUP BY campaign_id
        `);

        console.log("\nSales Volumes (Dec):");
        console.table(sales.rows);

        // 3. Calculate and Match
        let totalRev = 0;
        console.log("\n--- CALCULATION ---");

        sales.rows.forEach(s => {
            const camp = camps.rows.find(c => c.id == s.campaign_id);
            if (camp) {
                // Fix C21 Price if 0
                let price = parseFloat(camp.price);
                if (camp.id === 21 && price === 0) price = 20.00;

                const rev = s.qty * price;
                totalRev += rev;
                console.log(`[#${camp.id}] ${camp.title}: ${s.qty} items * R$ ${price.toFixed(2)} = R$ ${rev.toFixed(2)}`);
            }
        });

        console.log("--------------------------------");
        console.log(`TOTAL CALCULATED: R$ ${totalRev.toFixed(2)}`);

    } catch (e) {
        console.error(e);
    }
}
breakdown();
