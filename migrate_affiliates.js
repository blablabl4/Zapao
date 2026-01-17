const { Client } = require('pg');

(async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
        await client.connect();

        console.log('Running Affiliate Migration...');

        const sql = `
            -- VIP Affiliates Table
            CREATE TABLE IF NOT EXISTS az_vip_affiliates (
                id SERIAL PRIMARY KEY,
                phone VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                pix_key VARCHAR(100) NOT NULL,
                zip_code VARCHAR(20) NOT NULL,
                parent_id INTEGER REFERENCES az_vip_affiliates(id),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP
            );

            -- Link Purchases to Affiliates
            ALTER TABLE az_vip_purchases ADD COLUMN IF NOT EXISTS affiliate_id INTEGER REFERENCES az_vip_affiliates(id);

            -- Index
            CREATE INDEX IF NOT EXISTS idx_az_vip_purchases_affiliate ON az_vip_purchases(affiliate_id);
        `;

        await client.query(sql);
        console.log('Affiliate migration success!');
    } catch (e) {
        console.error('Migration Error:', e);
        process.exit(1);
    } finally {
        await client.end();
    }
})();
