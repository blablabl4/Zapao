process.env.DATABASE_URL = 'postgresql://postgres:RoundhouseKick5000@roundhouse.proxy.rlwy.net:56667/railway?sslmode=no-verify';
const { query } = require('../src/database/db');

async function migrate() {
    try {
        console.log('Starting migration: Adding referrer_id to orders table...');
        await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS referrer_id TEXT;`);
        console.log('Migration successful!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
