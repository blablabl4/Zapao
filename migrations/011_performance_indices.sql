-- Migration: Add performance indices
-- Created: 2025-12-26

-- Index on az_claims for phone lookup (very common query)
CREATE INDEX IF NOT EXISTS idx_az_claims_phone ON az_claims(phone);

-- Index on az_claims for campaign filtering
CREATE INDEX IF NOT EXISTS idx_az_claims_campaign_id ON az_claims(campaign_id);

-- Index on az_tickets for campaign and status filtering
CREATE INDEX IF NOT EXISTS idx_az_tickets_campaign_status ON az_tickets(campaign_id, status);

-- Index on az_tickets for assigned_claim_id (join optimization)
CREATE INDEX IF NOT EXISTS idx_az_tickets_claim_id ON az_tickets(assigned_claim_id);

-- Index on az_events for campaign analytics
CREATE INDEX IF NOT EXISTS idx_az_events_campaign_id ON az_events(campaign_id);

-- Index on session table for cleanup (expires column)
CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);

-- Composite index for common admin queries
CREATE INDEX IF NOT EXISTS idx_az_claims_campaign_claimed ON az_claims(campaign_id, claimed_at DESC);
