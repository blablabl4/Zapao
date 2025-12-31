-- Migration: Create az_bolao_validations table
-- For tracking participant validation confirmations

CREATE TABLE IF NOT EXISTS az_bolao_validations (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    cpf VARCHAR(14),
    name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending', -- 'confirmed', 'disputed'
    validated_at TIMESTAMP DEFAULT NOW(),
    games_shown JSONB, -- {"1": 2, "2": 1} cotas por jogo
    ip_address VARCHAR(50),
    user_agent TEXT
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_validations_phone ON az_bolao_validations(phone);
CREATE INDEX IF NOT EXISTS idx_validations_status ON az_bolao_validations(status);
