const { query, closeDatabase } = require('./src/database/db');
require('dotenv').config();

async function run() {
    try {
        console.log('Creating Initial Bolão Campaign...');

        // Check if exists
        const check = await query("SELECT * FROM az_campaigns WHERE type = 'BOLAO'");
        if (check.rows.length > 0) {
            console.log('Bolão Campaign already exists:', check.rows[0].id);
            return;
        }

        // Insert
        const res = await query(`
            INSERT INTO az_campaigns 
            (name, start_number, end_number, base_qty_config, is_active, type, current_round, price)
            VALUES 
            ('Bolão do Zapão - Mega da Virada', 1, 100, '{}', true, 'BOLAO', 1, 20.00)
            RETURNING id
        `);

        console.log('✅ Created Campaign ID:', res.rows[0].id);

        // Tickets are generated lazily by the service logic or we can pre-gen them?
        // Service logic (BolaoService.js) checks availability. 
        // It says: "If ticket doesn't exist yet... we insert it".
        // SO we are good.

    } catch (e) {
        console.error(e);
    } finally {
        await closeDatabase();
    }
}

run();
