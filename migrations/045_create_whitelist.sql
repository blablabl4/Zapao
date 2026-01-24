-- Create Whitelist Table
CREATE TABLE IF NOT EXISTS az_whitelist (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_whitelist_phone ON az_whitelist(phone);
