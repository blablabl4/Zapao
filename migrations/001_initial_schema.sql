-- TVZapão Production Schema (PostgreSQL)
-- Migration 001: Initial schema with draw scheduling

-- Orders table: stores all purchase orders
CREATE TABLE IF NOT EXISTS orders (
    order_id VARCHAR(255) PRIMARY KEY,
    number INTEGER NOT NULL CHECK(number >= 0 AND number <= 99),
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK(status IN ('PENDING', 'PAID', 'EXPIRED')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    buyer_ref TEXT,
    draw_id INTEGER -- Foreign key to draws
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(number);
CREATE INDEX IF NOT EXISTS idx_orders_expires_at ON orders(expires_at);
CREATE INDEX IF NOT EXISTS idx_orders_draw_id ON orders(draw_id);

-- Payments table: records confirmed payments
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    txid VARCHAR(255),
    e2eid VARCHAR(255),
    amount_paid DECIMAL(10,2) NOT NULL,
    paid_at TIMESTAMP NOT NULL DEFAULT NOW(),
    event_hash VARCHAR(255) UNIQUE NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_event_hash ON payments(event_hash);

-- Webhook events table: logs all incoming webhook events
CREATE TABLE IF NOT EXISTS webhook_events (
    id SERIAL PRIMARY KEY,
    received_at TIMESTAMP NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP,
    raw_payload TEXT NOT NULL,
    hash VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK(status IN ('PENDING', 'PROCESSED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_hash ON webhook_events(hash);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);

-- Draws table: manages raffle rounds with 1-hour windows
CREATE TABLE IF NOT EXISTS draws (
    id SERIAL PRIMARY KEY,
    draw_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK(status IN ('SCHEDULED', 'ACTIVE', 'CLOSED')),
    prize_base DECIMAL(10,2) NOT NULL DEFAULT 500.00,
    reserve_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration_minutes INTEGER DEFAULT 60,
    drawn_number INTEGER CHECK(drawn_number >= 0 AND drawn_number <= 99),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMP,
    winners_count INTEGER DEFAULT 0,
    payout_each DECIMAL(10,2) DEFAULT 0.00,
    sales_locked BOOLEAN DEFAULT FALSE,
    lock_time TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_draws_status ON draws(status);
CREATE INDEX IF NOT EXISTS idx_draws_end_time ON draws(end_time);

-- Add foreign key constraint (after draws table exists)
ALTER TABLE orders ADD CONSTRAINT fk_orders_draw 
    FOREIGN KEY (draw_id) REFERENCES draws(id) ON DELETE SET NULL;
