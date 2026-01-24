-- Migration 005: Amigos House Winner Logic

ALTER TABLE az_campaigns 
ADD COLUMN IF NOT EXISTS house_winner_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS house_winner_number INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS house_winner_name VARCHAR(255) DEFAULT NULL;

-- Reserve status in tickets IF NOT EXISTS (Just ensuring we can use a new status if needed, 
-- but actually we might just use 'ASSIGNED' with a special claim or a new status 'HOUSE_RESERVED')
-- Let's stick to adding a check constraint or just handling it in app logic if status is varchar.
-- The existing status is VARCHAR(20), so we can just use 'HOUSE_RESERVED'.
