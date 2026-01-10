-- Sub-affiliates table for affiliate sub-links
CREATE TABLE IF NOT EXISTS sub_affiliates (
    id SERIAL PRIMARY KEY,
    parent_phone VARCHAR(20) NOT NULL,
    sub_name VARCHAR(255) NOT NULL,
    sub_code VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sub_affiliates_parent ON sub_affiliates(parent_phone);
CREATE INDEX IF NOT EXISTS idx_sub_affiliates_code ON sub_affiliates(sub_code);
