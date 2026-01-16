/**
 * Migration 041: Campaigns and Notification Logs
 * Creates tables for remarketing campaigns and notification tracking
 */
const { query } = require('../src/database/db');

async function up() {
    console.log('[Migration 041] Creating campaigns and notification_logs tables...');

    // 1. Campaigns table
    await query(`
        CREATE TABLE IF NOT EXISTS campaigns (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            title VARCHAR(255) NOT NULL,
            body TEXT NOT NULL,
            url TEXT,
            icon TEXT DEFAULT '/icon-192.png',
            affiliate_code VARCHAR(100),
            segment VARCHAR(50) DEFAULT 'all',
            trigger_type VARCHAR(50),
            scheduled_at TIMESTAMP WITH TIME ZONE,
            sent_at TIMESTAMP WITH TIME ZONE,
            status VARCHAR(20) DEFAULT 'draft',
            total_sent INTEGER DEFAULT 0,
            total_failed INTEGER DEFAULT 0,
            total_clicked INTEGER DEFAULT 0,
            created_by VARCHAR(100),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    `);
    console.log('[Migration 041] ✓ campaigns table created');

    // 2. Notification logs table
    await query(`
        CREATE TABLE IF NOT EXISTS notification_logs (
            id SERIAL PRIMARY KEY,
            campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
            subscription_id INTEGER,
            endpoint TEXT,
            status VARCHAR(20) NOT NULL,
            error_message TEXT,
            clicked_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    `);
    console.log('[Migration 041] ✓ notification_logs table created');

    // 3. Add columns to push_subscriptions if not exist
    await query(`
        ALTER TABLE push_subscriptions 
        ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
        ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS notifications_sent INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS notifications_clicked INTEGER DEFAULT 0
    `);
    console.log('[Migration 041] ✓ push_subscriptions columns added');

    // 4. Create index for faster segment queries
    await query(`
        CREATE INDEX IF NOT EXISTS idx_notification_logs_campaign 
        ON notification_logs(campaign_id)
    `);
    await query(`
        CREATE INDEX IF NOT EXISTS idx_campaigns_status 
        ON campaigns(status)
    `);
    await query(`
        CREATE INDEX IF NOT EXISTS idx_push_subscriptions_phone 
        ON push_subscriptions(phone)
    `);
    console.log('[Migration 041] ✓ Indexes created');

    console.log('[Migration 041] ✅ Migration complete!');
}

async function down() {
    await query('DROP TABLE IF EXISTS notification_logs CASCADE');
    await query('DROP TABLE IF EXISTS campaigns CASCADE');
    // Don't drop columns from push_subscriptions to avoid data loss
}

module.exports = { up, down };

// Auto-run if called directly
if (require.main === module) {
    up().then(() => process.exit(0)).catch(e => {
        console.error(e);
        process.exit(1);
    });
}
