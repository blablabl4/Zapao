const { query } = require('./src/database/db');

async function checkSchema() {
    try {
        console.log('--- DRAWS COLUMNS ---');
        const drawsConfig = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'draws'
        `);
        drawsConfig.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));

        console.log('\n--- ORDERS COLUMNS ---');
        const ordersConfig = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'orders'
        `);
        ordersConfig.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkSchema();
