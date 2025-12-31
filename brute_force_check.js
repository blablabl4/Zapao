const { query } = require('./src/database/db');

async function bruteForce() {
    console.log('--- Brute Force Check (JS Side) ---');
    try {
        // 1. Get Claims
        const claims = await query("SELECT id, total_qty FROM az_claims WHERE campaign_id=21 AND status='PAID'");
        const claimMap = {};
        let sumQty = 0;
        claims.rows.forEach(c => {
            claimMap[c.id] = c.total_qty;
            sumQty += c.total_qty;
        });
        console.log(`Claims: ${claims.rows.length}, SumQty: ${sumQty}`);

        // 2. Get Tickets
        const tickets = await query("SELECT assigned_claim_id, count(*) as cnt FROM az_tickets WHERE campaign_id=21 AND status='ASSIGNED' AND assigned_claim_id IS NOT NULL GROUP BY assigned_claim_id");
        const ticketMap = {};
        let sumTix = 0;
        tickets.rows.forEach(t => {
            const cid = t.assigned_claim_id;
            const cnt = parseInt(t.cnt);
            ticketMap[cid] = cnt;
            sumTix += cnt;
        });
        console.log(`Ticket Groups: ${tickets.rows.length}, SumTix: ${sumTix}`);

        // 3. Compare
        const diffs = [];
        for (const [cid, qty] of Object.entries(claimMap)) {
            const tix = ticketMap[cid] || 0;
            if (tix !== qty) {
                diffs.push({ claim_id: cid, paid: qty, has: tix });
            }
        }

        if (diffs.length > 0) {
            console.log("FOUND DISCREPANCIES:");
            console.table(diffs);
        } else {
            console.log("No discrepancies found in JS check.");
        }

    } catch (e) {
        console.error(e);
    }
}
bruteForce();
