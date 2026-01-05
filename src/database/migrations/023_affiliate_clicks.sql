CREATE TABLE IF NOT EXISTS affiliate_clicks (
    id SERIAL PRIMARY KEY,
    referrer_id VARCHAR(255) NOT NULL,
    draw_id INTEGER REFERENCES draws(id),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_ref_draw ON affiliate_clicks(referrer_id, draw_id);
