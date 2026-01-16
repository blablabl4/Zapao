-- ============================================
-- SCRATCHCARD SYSTEM - COMPLETE MIGRATION
-- ============================================

-- 1. Scratchcards table
CREATE TABLE IF NOT EXISTS scratchcards (
    id SERIAL PRIMARY KEY,
    customer_id UUID REFERENCES customers(id),
    order_id VARCHAR(255) NOT NULL,
    draw_id INTEGER REFERENCES draws(id),
    token VARCHAR(100) UNIQUE NOT NULL,
    is_affiliate_order BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, REVEALED, CLAIMED, EXPIRED
    is_winner BOOLEAN,
    prize_value DECIMAL(10,2),
    prize_tier VARCHAR(20),  -- TEASER, BRONZE, SILVER, GOLD
    generated_grid TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    revealed_at TIMESTAMP,
    claimed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scratchcards_customer_id ON scratchcards(customer_id);
CREATE INDEX IF NOT EXISTS idx_scratchcards_draw_id ON scratchcards(draw_id);
CREATE INDEX IF NOT EXISTS idx_scratchcards_status ON scratchcards(status);
CREATE INDEX IF NOT EXISTS idx_scratchcards_token ON scratchcards(token);

-- 2. Prize tiers configuration per draw
CREATE TABLE IF NOT EXISTS scratch_prize_tiers (
    id SERIAL PRIMARY KEY,
    draw_id INTEGER REFERENCES draws(id),
    tier_name VARCHAR(20) NOT NULL,           -- TEASER, BRONZE, SILVER, GOLD
    revenue_percent INTEGER NOT NULL,          -- 0 for teaser, 400, 600, 900
    total_budget DECIMAL(10,2) NOT NULL,       -- 100, 100, 300, 500
    prize_value DECIMAL(10,2) DEFAULT 10.00,
    prizes_available INTEGER GENERATED ALWAYS AS (FLOOR(total_budget / prize_value)) STORED,
    prizes_given INTEGER DEFAULT 0,
    requires_min_spent BOOLEAN DEFAULT TRUE,   -- FALSE for teaser
    allows_affiliate BOOLEAN DEFAULT FALSE,    -- TRUE only for teaser
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prize_tiers_draw ON scratch_prize_tiers(draw_id);

-- 3. Global scratch config
CREATE TABLE IF NOT EXISTS scratch_config (
    key VARCHAR(50) PRIMARY KEY,
    value VARCHAR(255),
    description TEXT
);

INSERT INTO scratch_config (key, value, description) VALUES
('enabled', 'true', 'Feature flag global'),
('min_customer_spent', '225.00', 'Gasto mínimo do cliente para prêmios pós-teaser'),
('min_order_value', '10.50', 'Valor mínimo da compra para gerar raspadinha'),
('prize_value', '10.00', 'Valor fixo de cada prêmio'),
('win_chance_percent', '20', 'Chance de vitória quando critérios OK'),
('max_wins_per_customer_per_draw', '1', 'Máximo de prêmios por cliente por rifa')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 4. Add luck_points to customers (pity timer)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS luck_points INTEGER DEFAULT 0;

-- 5. Add scratchcard_enabled flag to draws
ALTER TABLE draws ADD COLUMN IF NOT EXISTS scratchcard_enabled BOOLEAN DEFAULT TRUE;

-- 6. Function to initialize prize tiers for a new draw
CREATE OR REPLACE FUNCTION initialize_scratch_tiers_for_draw(p_draw_id INTEGER)
RETURNS VOID AS $$
BEGIN
    -- Only create if not exists
    IF NOT EXISTS (SELECT 1 FROM scratch_prize_tiers WHERE draw_id = p_draw_id) THEN
        INSERT INTO scratch_prize_tiers (draw_id, tier_name, revenue_percent, total_budget, requires_min_spent, allows_affiliate)
        VALUES 
            (p_draw_id, 'TEASER', 0, 100.00, FALSE, TRUE),
            (p_draw_id, 'BRONZE', 400, 100.00, TRUE, FALSE),
            (p_draw_id, 'SILVER', 600, 300.00, TRUE, FALSE),
            (p_draw_id, 'GOLD', 900, 500.00, TRUE, FALSE);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 7. Initialize tiers for all existing active draws
DO $$
DECLARE
    draw_record RECORD;
BEGIN
    FOR draw_record IN SELECT id FROM draws WHERE status IN ('ACTIVE', 'PENDING') LOOP
        PERFORM initialize_scratch_tiers_for_draw(draw_record.id);
    END LOOP;
END $$;
