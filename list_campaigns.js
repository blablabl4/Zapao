const { query } = require('./src/database/db');

async function listCampaigns() {
    console.log('--- Listing All Campaigns ---');
    try {
        const res = await query("SELECT * FROM az_campaigns");
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    }
}
listCampaigns();
