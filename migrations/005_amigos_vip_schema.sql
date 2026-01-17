-- Migration 005: Amigos do Zapão VIP (Paid Version)

-- 1. VIP Purchases Table
CREATE TABLE IF NOT EXISTS az_vip_purchases (
    id VARCHAR(50) PRIMARY KEY, -- Format: VIP-{UUID}
    campaign_id INTEGER REFERENCES az_campaigns(id),
    phone VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    qty INTEGER NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, PAID, EXPIRED
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP,
    expires_at TIMESTAMP, -- 10 minutes from creation
    pix_qr_code TEXT,
    pix_copy_paste TEXT,
    transaction_id VARCHAR(100), -- Payment Provider Transaction ID
    ip VARCHAR(50),
    user_agent TEXT,
    device_id VARCHAR(255)
);

-- Index for quick lookup by phone
CREATE INDEX IF NOT EXISTS idx_az_vip_phone ON az_vip_purchases(phone);
-- Index for status-based queries
CREATE INDEX IF NOT EXISTS idx_az_vip_status ON az_vip_purchases(status);

-- 2. Extend az_tickets to link to VIP purchases
ALTER TABLE az_tickets ADD COLUMN IF NOT EXISTS assigned_purchase_id VARCHAR(50) REFERENCES az_vip_purchases(id);

-- Index for finding tickets by purchase
CREATE INDEX IF NOT EXISTS idx_az_tickets_purchase ON az_tickets(assigned_purchase_id);

-- 3. VIP Affiliates Table
CREATE TABLE IF NOT EXISTS az_vip_affiliates (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    pix_key VARCHAR(100) NOT NULL,
    zip_code VARCHAR(20) NOT NULL,
    parent_id INTEGER REFERENCES az_vip_affiliates(id), -- Sub-affiliate logic
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- 4. Link Purchases to Affiliates
ALTER TABLE az_vip_purchases ADD COLUMN IF NOT EXISTS affiliate_id INTEGER REFERENCES az_vip_affiliates(id);

-- Index for affiliate performance
CREATE INDEX IF NOT EXISTS idx_az_vip_purchases_affiliate ON az_vip_purchases(affiliate_id);

