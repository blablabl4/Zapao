const { query, closeDatabase } = require('../src/database/db');

async function migrate() {
    try {
        console.log('Starting migration for Phone+Password auth...');

        // Add phone and password_hash columns
        // Make email optional (nullable)
        // Add constraint for unique phone

        await query(`
            ALTER TABLE admin_users 
            ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
            ADD COLUMN IF NOT EXISTS password_hash TEXT,
            ALTER COLUMN email DROP NOT NULL;
        `);

        // Ensure phone is unique
        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_users_phone_key') THEN
                    ALTER TABLE admin_users ADD CONSTRAINT admin_users_phone_key UNIQUE (phone);
                END IF;
            END
            $$;
        `);

        console.log('Migration completed successfully.');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await closeDatabase();
    }
}

migrate();
