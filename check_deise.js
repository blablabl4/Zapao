const { query } = require('./src/database/db');

async function inspectDeise() {
    try {
        console.log('Searching for Deise...');
        const aff = await query(`SELECT * FROM affiliates WHERE name LIKE '%Deise%'`);
        const deise = aff.rows[0];
        console.log(deise);

        if (deise) {
            console.log(`Checking commission for ${deise.phone}...`);
            const salesRes = await query(`SELECT sum(amount) as total FROM orders WHERE referrer_id = $1 AND status = 'PAID'`, [deise.phone]);
            const total = parseFloat(salesRes.rows[0].total || 0);

            // Assume 20%
            const calc20 = total * 0.20;
            // Assume 25%
            const calc25 = total * 0.25;

            console.log(`Total Sales: ${total}`);
            console.log(`Calc 20%: ${calc20}`);
            console.log(`Calc 25%: ${calc25}`);
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
inspectDeise();
