const { query } = require('../src/database/db');

async function run() {
    try {
        console.log('Forcing min_order_value to 1.00...');
        await query(`
            INSERT INTO config (key, value) 
            VALUES ('min_order_value', '1.00') 
            ON CONFLICT (key) DO UPDATE SET value = '1.00'
        `);
        console.log('Done!');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
