const { query } = require('../src/database/db');

async function up() {
    // Enable Scratchcards and set min value to 1.00 for testing
    // Config key: 'scratchcard_enabled'
    // Config key: 'min_order_value'

    await query(`
        INSERT INTO app_config (key, value, description)
        VALUES 
            ('scratchcard_enabled', 'true', 'Enable scratchcard system'),
            ('min_order_value', '1.00', 'Minimum order value to get scratchcard')
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
    `);

    // Also update existing prizes to be active if needed
    console.log('Migration up: Adjusted scratchcard config for testing');
}

async function down() {
    // Revert to default 10.50
    await query("UPDATE app_config SET value = '10.50' WHERE key = 'min_order_value'");
}

module.exports = { up, down };
