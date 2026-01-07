const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Run all migrations in order
 */
async function runMigrations() {
    const client = await pool.connect();

    try {
        console.log('[Migration] Starting database migrations...');

        // Create migrations tracking table
        await client.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                executed_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Get list of migration files
        const migrationsDir = path.join(__dirname);
        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        for (const file of files) {
            // Check if already executed
            const result = await client.query(
                'SELECT * FROM migrations WHERE name = $1',
                [file]
            );

            if (result.rows.length > 0) {
                console.log(`[Migration] Skipping ${file} (already executed)`);
                continue;
            }

            // Read and execute migration
            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
            console.log(`[Migration] Executing ${file}...`);

            await client.query('BEGIN');
            await client.query(sql);
            await client.query(
                'INSERT INTO migrations (name) VALUES ($1)',
                [file]
            );
            await client.query('COMMIT');

            console.log(`[Migration] ✅ ${file} completed`);
        }

        console.log('[Migration] All migrations completed successfully');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Migration] Error:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Run if called directly
if (require.main === module) {
    runMigrations()
        .then(() => {
            console.log('[Migration] Done');
            process.exit(0);
        })
        .catch(err => {
            console.error('[Migration] Failed:', err);
            console.warn('[Migration] ⚠️ WARNING: Migration failed but proceeding to start server to avoid crash loop.');
            process.exit(0);
        });
}

module.exports = { runMigrations };
