-- Migration 027: Affiliate Payments Table
-- Track payments made to affiliates with minimum withdrawal of R$ 500

CREATE TABLE IF NOT EXISTS affiliate_payments (
    id SERIAL PRIMARY KEY,
    affiliate_phone VARCHAR(20) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 500.00),
    payment_date TIMESTAMP DEFAULT NOW(),
    payment_method VARCHAR(50) DEFAULT 'PIX',
    reference VARCHAR(255),
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookups by phone
CREATE INDEX IF NOT EXISTS idx_affiliate_payments_phone ON affiliate_payments(affiliate_phone);

-- Index for payment date queries
CREATE INDEX IF NOT EXISTS idx_affiliate_payments_date ON affiliate_payments(payment_date DESC);

COMMENT ON TABLE affiliate_payments IS 'Payment history for affiliates with R$ 500 minimum withdrawal';
COMMENT ON COLUMN affiliate_payments.amount IS 'Payment amount in BRL (minimum R$ 500.00)';
COMMENT ON COLUMN affiliate_payments.payment_method IS 'Payment method: PIX, Transferência, Dinheiro, etc';
COMMENT ON COLUMN affiliate_payments.reference IS 'Payment reference/receipt ID';
COMMENT ON COLUMN affiliate_payments.created_by IS 'Admin who registered the payment';
