const { query } = require('./src/database/db');

async function checkTimestamps() {
    try {
        console.log('Checking timestamps for Wilson and Marcelo...');
        const res = await query(`
            SELECT buyer_ref, created_at 
            FROM orders 
            WHERE number = 46 AND (buyer_ref LIKE 'Wilson%' OR buyer_ref LIKE 'Marcelo%')
        `);

        res.rows.forEach(r => {
            console.log(`User: ${r.buyer_ref.split('|')[0]}`);
            console.log(`Created At (DB): ${r.created_at}`);
            // Postgres node driver usually returns Date object
            console.log(`ISO: ${new Date(r.created_at).toISOString()}`);
        });

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkTimestamps();
