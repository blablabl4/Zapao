const { query } = require('./src/database/db');

async function analyzeAll() {
    console.log('--- GLOBAL REVENUE ANALYSIS (DECEMBER) ---');
    try {
        // Get Revenue grouped by Campaign, joining with campaign price
        // Note: az_campaigns has 'price' or 'ticket_price'? 
        // I'll check az_campaigns columns first in the query or assume based on previous knowledge.
        // Step 10462 logs showed price is often 0 in DB for C21, defaulting to 20.
        // I will fetch campaigns first to map prices manually if needed.

        const campaigns = await query("SELECT id, title, price FROM az_campaigns");
        const priceMap = {};
        campaigns.rows.forEach(c => {
            // Fix: C21 is 0.00 in DB but 20.00 real.
            let p = parseFloat(c.price);
            if (c.id === 21 && p === 0) p = 20.00;
            priceMap[c.id] = p;
        });

        const sql = `
            SELECT campaign_id, count(*) as tx_count, sum(total_qty) as total_qty
            FROM az_claims
            WHERE status='PAID' AND claimed_at > '2025-12-01'
            GROUP BY campaign_id
            ORDER BY total_qty DESC
        `;

        const res = await query(sql);

        console.log("Campaign | Qty Sold | Est. Price | Total Revenue");
        console.log("---------|----------|------------|--------------");

        let grandTotal = 0;

        res.rows.forEach(r => {
            const cid = r.campaign_id;
            const qty = parseInt(r.total_qty);
            const price = priceMap[cid] || 0;
            const subtotal = qty * price;
            grandTotal += subtotal;

            const cName = campaigns.rows.find(c => c.id === cid)?.title || 'Unknown';

            console.log(`#${cid} ${cName.substring(0, 15)}... | ${qty} | R$ ${price.toFixed(2)} | R$ ${subtotal.toFixed(2)}`);
        });

        console.log("----------------------------------------------");
        console.log(`GRAND TOTAL (Est.): R$ ${grandTotal.toFixed(2)}`);

    } catch (e) {
        console.error(e);
    }
}
analyzeAll();
