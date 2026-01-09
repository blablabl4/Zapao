-- Migration 026: Update number constraints from 0-99 to 1-150
-- CRITICAL: This fixes database constraint blocking purchases of numbers 100-150
-- Updated to handle existing data that may violate new constraint

-- Drop old constraints on orders table (ignore errors if not exists)
DO $$ 
BEGIN
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_number_check;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Add new constraint for 1-150 range - NOT VALID to skip existing data
ALTER TABLE orders ADD CONSTRAINT orders_number_check 
    CHECK (number >= 1 AND number <= 150) NOT VALID;

-- Drop old constraint on draws table
DO $$ 
BEGIN
    ALTER TABLE draws DROP CONSTRAINT IF EXISTS draws_drawn_number_check;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Add new constraint for drawn_number 1-150 - NOT VALID to skip existing data
ALTER TABLE draws ADD CONSTRAINT draws_drawn_number_check 
    CHECK (drawn_number >= 1 AND drawn_number <= 150) NOT VALID;
