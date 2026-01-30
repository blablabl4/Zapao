-- Migration 048: Bot Auth Persistence
-- Store WhatsApp Baileys auth in PostgreSQL to survive Railway deploys

CREATE TABLE IF NOT EXISTS bot_auth (
    key VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bot_auth_updated ON bot_auth(updated_at);

COMMENT ON TABLE bot_auth IS 'Stores WhatsApp Baileys authentication data for persistence across deploys';
