-- Migration 008: Add share_text to promotions

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'az_promotions' AND column_name = 'share_text'
    ) THEN
        ALTER TABLE az_promotions ADD COLUMN share_text TEXT;
    END IF;
END $$;
