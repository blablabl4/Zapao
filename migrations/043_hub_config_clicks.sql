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
