const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('Checking for BOLAO campaign...');
        const res = await pool.query("SELECT * FROM az_campaigns WHERE type = 'BOLAO'");

        if (res.rows.length === 0) {
            console.log('Campaign NOT FOUND. Inserting...');
            await pool.query(`
                INSERT INTO az_campaigns (name, start_number, end_number, base_qty_config, is_active, type, current_round, price)
                VALUES ('Bolão do Zapão - Mega da Virada', 1, 100, '{}', true, 'BOLAO', 1, 20.00)
            `);
            console.log('Campaign INSERTED.');
        } else {
            console.log('Campaign FOUND:', res.rows[0]);
            if (!res.rows[0].is_active) {
                console.log('Campaign is INACTIVE. Activating...');
                await pool.query("UPDATE az_campaigns SET is_active = true WHERE id = $1", [res.rows[0].id]);
                console.log('Campaign ACTIVATED.');
            } else {
                console.log('Campaign is already ACTIVE.');
            }
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        pool.end();
    }
}

run();
