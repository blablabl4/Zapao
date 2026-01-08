-- Migration 024: Update total_numbers default to 150
-- Expand raffle capacity from 100 to 150 numbers

-- Update default for new draws
ALTER TABLE draws 
ALTER COLUMN total_numbers SET DEFAULT 150;

-- Update active and scheduled draws to use 150 numbers
UPDATE draws 
SET total_numbers = 150 
WHERE status IN ('ACTIVE', 'SCHEDULED');
