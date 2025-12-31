const { query } = require('./src/database/db');

async function checkIndices() {
    console.log('--- Checking Indices ---');
    try {
        const tables = ['az_campaigns', 'az_tickets', 'az_claims', 'az_leads'];

        for (const t of tables) {
            console.log(`\nTable: ${t}`);
            const res = await query(`
                SELECT indexname, indexdef 
                FROM pg_indexes 
                WHERE tablename = $1
            `, [t]);

            res.rows.forEach(r => {
                console.log(`   ${r.indexname}: ${r.indexdef}`);
            });
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

checkIndices();
