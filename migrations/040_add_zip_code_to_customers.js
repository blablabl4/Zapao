const { query } = require('../src/database/db');

async function up() {
    await query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS zip_code VARCHAR(20)`);
    console.log('Migration 040 applied: zip_code column added to customers');
}

module.exports = { up };
