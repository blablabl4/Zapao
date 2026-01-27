-- Migration 046: Campaign Redesign
-- Whitelist por campanha + campos para tracking de estado

-- 1. Adiciona campaign_id na whitelist (suporte a whitelist por campanha)
ALTER TABLE az_whitelist ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES az_campaigns(id);

-- 2. Remove constraint UNIQUE antiga e adiciona nova com campaign
-- (permite mesmo telefone em campanhas diferentes)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'az_whitelist_phone_key') THEN
        ALTER TABLE az_whitelist DROP CONSTRAINT az_whitelist_phone_key;
    END IF;
END $$;

-- Nova constraint: único por campanha
ALTER TABLE az_whitelist DROP CONSTRAINT IF EXISTS az_whitelist_campaign_phone_unique;
ALTER TABLE az_whitelist ADD CONSTRAINT az_whitelist_campaign_phone_unique UNIQUE(campaign_id, phone);

-- 3. Adiciona campo para marcar campanha como finalizada
ALTER TABLE az_campaigns ADD COLUMN IF NOT EXISTS finished_at TIMESTAMP;

-- 4. Adiciona campo para referenciar campanha original (para duplicações)
ALTER TABLE az_campaigns ADD COLUMN IF NOT EXISTS cloned_from INTEGER REFERENCES az_campaigns(id);

-- 5. Index para busca rápida de whitelist por campanha
CREATE INDEX IF NOT EXISTS idx_whitelist_campaign ON az_whitelist(campaign_id);
