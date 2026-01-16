const { query } = require('../src/database/db');

async function up() {
    await query(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            endpoint TEXT PRIMARY KEY,
            keys JSONB NOT NULL,
            user_id UUID REFERENCES customers(id),
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
    `);

    // Index for finding user subs quickly
    await query('CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);');

    console.log('Migration up: push_subscriptions table created');
}

async function down() {
    await query('DROP TABLE IF EXISTS push_subscriptions');
}

module.exports = { up, down };
