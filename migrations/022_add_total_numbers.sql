-- Migration to add total_numbers to draws table
ALTER TABLE draws ADD COLUMN IF NOT EXISTS total_numbers INTEGER DEFAULT 75;

-- Update existing draws to have 75 numbers
UPDATE draws SET total_numbers = 75 WHERE total_numbers IS NULL;
