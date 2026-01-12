-- Migration to track prize payments separately from affiliate payments
CREATE TABLE IF NOT EXISTS winner_payments (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL, -- Links to the winning order
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'PIX',
    reference TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100),
    UNIQUE(order_id) -- Only one payment per winning order
);

CREATE INDEX IF NOT EXISTS idx_winner_payments_order ON winner_payments(order_id);
