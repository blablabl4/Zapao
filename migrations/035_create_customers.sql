-- Create Customers Table (Centralized User Identity)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255), -- Can be updated later
    pix_key VARCHAR(255), -- Last used PIX key
    email VARCHAR(255), -- Optional
    birth_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    total_spent DECIMAL(10,2) DEFAULT 0.00
);

-- Index for fast login lookup
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- Link existing Orders table to Customers (Backward Compatible)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);

-- Index for finding orders by customer
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
