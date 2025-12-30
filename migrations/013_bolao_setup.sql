-- Migration 013: Bolão do Zapão Setup
-- Support for:
-- 1. Campaign Types (STANDARD vs BOLAO)
-- 2. Automated Rounds (Jogos)
-- 3. Payment Integration (Mercado Pago)
-- 4. User Data (CPF)
-- 5. Ticket Uniqueness per Round

-- 1. Update az_campaigns
ALTER TABLE az_campaigns 
ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'STANDARD', -- 'STANDARD', 'BOLAO'
ADD COLUMN IF NOT EXISTS current_round INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS mp_access_token TEXT,
ADD COLUMN IF NOT EXISTS mp_public_key TEXT;

-- 2. Update az_tickets
ALTER TABLE az_tickets 
ADD COLUMN IF NOT EXISTS round_number INTEGER DEFAULT 1;

-- Drop old uniqueness constraint (campaign_id, number)
ALTER TABLE az_tickets DROP CONSTRAINT IF EXISTS az_tickets_campaign_id_number_key;

-- Add new uniqueness constraint (campaign_id, number, round_number)
-- This allows Number 1 to exist in Round 1 AND Round 2 simultaneously
ALTER TABLE az_tickets 
ADD CONSTRAINT az_tickets_camp_num_round_unique UNIQUE (campaign_id, number, round_number);

-- 3. Update az_claims
ALTER TABLE az_claims 
ADD COLUMN IF NOT EXISTS round_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS cpf VARCHAR(14),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PAID', -- 'PENDING', 'PAID', 'EXPIRED' (Old claims assume PAID)
ADD COLUMN IF NOT EXISTS payment_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS qr_code TEXT,
ADD COLUMN IF NOT EXISTS qr_code_base64 TEXT,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

-- 4. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_az_tickets_round ON az_tickets(campaign_id, round_number, status);
CREATE INDEX IF NOT EXISTS idx_az_claims_payment ON az_claims(payment_id);
CREATE INDEX IF NOT EXISTS idx_az_claims_status ON az_claims(status);

-- 5. Separate Table for Round History (Optional but good for stats)
CREATE TABLE IF NOT EXISTS az_bolao_rounds (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES az_campaigns(id),
    round_number INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- 'ACTIVE', 'COMPLETED'
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    total_sales DECIMAL(10, 2) DEFAULT 0.00,
    winner_ticket INTEGER,
    UNIQUE(campaign_id, round_number)
);

-- 6. Seed Initial Bolão Campaign (If not exists)
INSERT INTO az_campaigns (name, start_number, end_number, base_qty_config, is_active, type, current_round, price)
SELECT 'Bolão do Zapão - Mega da Virada', 1, 100, '{}', true, 'BOLAO', 1, 20.00
WHERE NOT EXISTS (SELECT 1 FROM az_campaigns WHERE type = 'BOLAO');
