-- Add sponsor_link field to promotions table
ALTER TABLE az_promotions ADD COLUMN IF NOT EXISTS sponsor_link TEXT;

-- Comment: This field stores the sponsor/advertiser contact link for each promotion
COMMENT ON COLUMN az_promotions.sponsor_link IS 'Link to sponsor or advertiser contact page';
