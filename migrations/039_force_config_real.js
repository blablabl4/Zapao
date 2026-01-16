const { query } = require('../src/database/db');

module.exports = async () => {
    console.log('[Migration] Forcing min_order_value to 1.00...');
    // Upsert to ensure it exists and is set to 1.00
    await query(`
        INSERT INTO config (key, value) 
        VALUES ('min_order_value', '1.00') 
        ON CONFLICT (key) DO UPDATE SET value = '1.00'
    `);
    console.log('[Migration] min_order_value set to 1.00');
};
