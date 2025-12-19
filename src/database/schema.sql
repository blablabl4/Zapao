-- Orders table: stores all purchase orders
CREATE TABLE IF NOT EXISTS orders (
    order_id TEXT PRIMARY KEY,
    number INTEGER NOT NULL CHECK(number >= 0 AND number <= 99),
    amount REAL NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('PENDING', 'PAID', 'EXPIRED')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    buyer_ref TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(number);
CREATE INDEX IF NOT EXISTS idx_orders_expires_at ON orders(expires_at);

-- Payments table: records confirmed payments
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    txid TEXT,
    e2eid TEXT,
    amount_paid REAL NOT NULL,
    paid_at TEXT NOT NULL DEFAULT (datetime('now')),
    event_hash TEXT UNIQUE NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_event_hash ON payments(event_hash);

-- Webhook events table: logs all incoming webhook events
CREATE TABLE IF NOT EXISTS webhook_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    received_at TEXT NOT NULL DEFAULT (datetime('now')),
    processed_at TEXT,
    raw_payload TEXT NOT NULL,
    hash TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('PENDING', 'PROCESSED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_hash ON webhook_events(hash);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);

-- Draws table: manages raffle rounds with prize pooling
CREATE TABLE IF NOT EXISTS draws (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'CLOSED')),
    prize_base REAL NOT NULL DEFAULT 500.00,
    reserve_amount REAL NOT NULL DEFAULT 0.00,
    drawn_number INTEGER CHECK(drawn_number >= 0 AND drawn_number <= 99),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    closed_at TEXT,
    winners_count INTEGER DEFAULT 0,
    payout_each REAL DEFAULT 0.00,
    sales_locked INTEGER DEFAULT 0,
    lock_time TEXT
);

CREATE INDEX IF NOT EXISTS idx_draws_status ON draws(status);
