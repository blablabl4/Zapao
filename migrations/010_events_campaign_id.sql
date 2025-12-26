-- Add campaign_id to az_events if not exists
ALTER TABLE az_events ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES az_campaigns(id);
