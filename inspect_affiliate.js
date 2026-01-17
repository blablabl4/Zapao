const { query } = require('./src/database/db');

async function inspectAffiliate() {
    try {
        console.log('Inspecting Marcos Luiz (11947781150) schema...');

        const res = await query(`
            SELECT * FROM affiliates 
            WHERE phone = '11947781150'
        `);

        if (res.rows.length > 0) {
            console.log('--- FULL AFFILIATE RECORD ---');
            console.log(JSON.stringify(res.rows[0], null, 2));

            // Also check columns just in case
            const schema = await query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'affiliates'
            `);
            console.log('\n--- TABLE SCHEMA ---');
            schema.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));
        } else {
            console.log('Affiliate not found.');
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
inspectAffiliate();
