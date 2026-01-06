const { query } = require('../src/database/db');

async function checkStats() {
    try {
        console.log('--- Clicks per Referrer ---');
        const clicks = await query("SELECT COUNT(*) as total, referrer_id FROM affiliate_clicks GROUP BY referrer_id");
        console.table(clicks.rows);

        console.log('--- Sales per Referrer ---');
        const sales = await query("SELECT COUNT(*) as total, referrer_id, status FROM orders WHERE referrer_id IS NOT NULL GROUP BY referrer_id, status");
        console.table(sales.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

checkStats();
