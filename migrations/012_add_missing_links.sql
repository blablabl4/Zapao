-- Migration 005: Add Links (Sponsor & Group)

-- Add sponsor_link to az_promotions
ALTER TABLE az_promotions ADD COLUMN IF NOT EXISTS sponsor_link TEXT;

-- Add group_link to az_campaigns
ALTER TABLE az_campaigns ADD COLUMN IF NOT EXISTS group_link TEXT;
