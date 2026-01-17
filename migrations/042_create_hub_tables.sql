CREATE TABLE IF NOT EXISTS whatsapp_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    invite_link TEXT UNIQUE NOT NULL,
    active BOOLEAN DEFAULT true,
    current_count INTEGER DEFAULT 0,
    capacity INTEGER DEFAULT 250,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) UNIQUE NOT NULL,
    assigned_group_id INTEGER REFERENCES whatsapp_groups(id),
    affiliate_token VARCHAR(100) UNIQUE,
    referrer_id INTEGER REFERENCES leads(id),
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'BANNED', 'LEFT')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookup by affiliate token
CREATE INDEX IF NOT EXISTS idx_leads_affiliate_token ON leads(affiliate_token);
-- Index for fast lookup by phone
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);

-- Hub Config Table (for banner, title, etc.)
CREATE TABLE IF NOT EXISTS hub_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT
);

-- Hub Clicks Table (for affiliate click tracking)
CREATE TABLE IF NOT EXISTS hub_clicks (
    id SERIAL PRIMARY KEY,
    affiliate_token VARCHAR(100),
    ip_address VARCHAR(50),
    user_agent TEXT,
    converted BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_clicks_token ON hub_clicks(affiliate_token);
CREATE INDEX IF NOT EXISTS idx_hub_clicks_created ON hub_clicks(created_at);
