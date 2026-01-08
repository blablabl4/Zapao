-- Migration to update default total_numbers from 75 to 100
ALTER TABLE draws ALTER COLUMN total_numbers SET DEFAULT 100;

-- Update existing ACTIVE/SCHEDULED draws to use 100 numbers (optional - preserves closed draws)
UPDATE draws SET total_numbers = 100 WHERE total_numbers = 75 AND status IN ('ACTIVE', 'SCHEDULED', 'PAUSED');
