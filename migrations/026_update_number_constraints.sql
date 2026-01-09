-- Migration 026: Update number constraints from 0-99 to 1-150
-- CRITICAL: This fixes database constraint blocking purchases of numbers 100-150

-- Drop old constraints on orders table
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_number_check;

-- Add new constraint for 1-150 range
ALTER TABLE orders ADD CONSTRAINT orders_number_check 
    CHECK (number >= 1 AND number <= 150);

-- Drop old constraint on draws table
ALTER TABLE draws DROP CONSTRAINT IF EXISTS draws_drawn_number_check;

-- Add new constraint for drawn_number 1-150
ALTER TABLE draws ADD CONSTRAINT draws_drawn_number_check 
    CHECK (drawn_number >= 1 AND drawn_number <= 150);
