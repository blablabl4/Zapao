-- Migration 004: Amigos do Zapão Schema

-- 1. Campaigns (Sorteios/Campanhas Amigos do Zapão)
CREATE TABLE IF NOT EXISTS az_campaigns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    start_number INTEGER NOT NULL,
    end_number INTEGER NOT NULL,
    base_qty_config JSONB NOT NULL DEFAULT '{}', -- Configuração por dia da semana
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Promotions (Promoções Especiais)
CREATE TABLE IF NOT EXISTS az_promotions (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES az_campaigns(id),
    name VARCHAR(255) NOT NULL,
    extra_qty INTEGER NOT NULL DEFAULT 0,
    starts_at TIMESTAMP NOT NULL,
    ends_at TIMESTAMP NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Promo Tokens (Links temporários)
CREATE TABLE IF NOT EXISTS az_promo_tokens (
    token VARCHAR(64) PRIMARY KEY,
    promotion_id INTEGER REFERENCES az_promotions(id),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Claims (Resgates)
CREATE TABLE IF NOT EXISTS az_claims (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES az_campaigns(id),
    phone VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    claimed_at TIMESTAMP DEFAULT NOW(),
    type VARCHAR(20) NOT NULL, -- 'NORMAL' or 'PROMO'
    promotion_id INTEGER REFERENCES az_promotions(id),
    promo_token VARCHAR(64),
    base_qty INTEGER NOT NULL,
    extra_qty INTEGER NOT NULL DEFAULT 0,
    total_qty INTEGER NOT NULL,
    next_unlock_at TIMESTAMP NOT NULL,
    ip VARCHAR(50),
    user_agent TEXT,
    device_id VARCHAR(255),
    session_id VARCHAR(100),
    lgpd_consent BOOLEAN DEFAULT FALSE
);

-- Index to quickly find claims by phone/campaign
CREATE INDEX IF NOT EXISTS idx_az_claims_phone ON az_claims(campaign_id, phone);

-- 5. Tickets (Números gerados/associados)
CREATE TABLE IF NOT EXISTS az_tickets (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES az_campaigns(id),
    number INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'ASSIGNED'
    assigned_claim_id INTEGER REFERENCES az_claims(id),
    updated_at TIMESTAMP,
    UNIQUE(campaign_id, number)
);

-- Index for finding available tickets
CREATE INDEX IF NOT EXISTS idx_az_tickets_avail ON az_tickets(campaign_id, status) WHERE status = 'AVAILABLE';
-- Index for finding tickets by claim
CREATE INDEX IF NOT EXISTS idx_az_tickets_claim ON az_tickets(assigned_claim_id);

-- 6. Promo Redemptions (Controle de 1 resgate por promoção por telefone)
CREATE TABLE IF NOT EXISTS az_promo_redemptions (
    promotion_id INTEGER REFERENCES az_promotions(id),
    phone VARCHAR(50) NOT NULL,
    redeemed_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(promotion_id, phone)
);

-- 7. Events (Tracking)
CREATE TABLE IF NOT EXISTS az_events (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL, -- 'VIEW', 'PROMO_VIEW', 'CLAIM_START', 'CLAIM_FINISH'
    promotion_id INTEGER,
    promo_token VARCHAR(64),
    phone VARCHAR(50),
    metadata JSONB,
    timestamp TIMESTAMP DEFAULT NOW(),
    ip VARCHAR(50),
    user_agent TEXT,
    device_id VARCHAR(255)
);

-- Insert Default Campaign (Example)
INSERT INTO az_campaigns (name, start_number, end_number, base_qty_config)
VALUES (
    'Campanha Inicial - Amigos do Zapão',
    0, 9999, 
    '{"sun":1, "mon":1, "tue":1, "wed":1, "thu":1, "fri":1, "sat":1}'
);

-- Trigger to create tickets? No, we will handle ticket generation in application logic 
-- or a store procedure, but application logic is safer for control now.
