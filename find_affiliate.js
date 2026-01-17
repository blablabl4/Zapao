const { query } = require('./src/database/db');

async function findAffiliate() {
    try {
        console.log('Searching for Marcos Luiz / ...1150');

        const aff = await query(`
            SELECT * FROM affiliates 
            WHERE phone LIKE '%1150' 
            OR name ILIKE '%Marcos Luiz%'
        `);
        console.log('\n--- Affiliates Table ---');
        console.log(aff.rows);

        const orders = await query(`
            SELECT count(*) as count, sum(amount) as sales 
            FROM orders 
            WHERE referrer_id LIKE '%1150'
            AND status = 'PAID'
        `);
        console.log('\n--- Orders (Referrer matching %1150) ---');
        console.log(orders.rows);

        const sub = await query(`
            SELECT * FROM sub_affiliates
            WHERE sub_phone LIKE '%1150'
            OR sub_name ILIKE '%Marcos Luiz%'
        `);
        console.log('\n--- Sub Affiliates Table ---');
        console.log(sub.rows);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
findAffiliate();
