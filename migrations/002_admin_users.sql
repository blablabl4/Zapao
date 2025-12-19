-- Migration 002: Admin users table

CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Session storage for express-session
CREATE TABLE IF NOT EXISTS session (
    sid VARCHAR(255) PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);

-- Constraint: apenas 1 admin permitido
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_admin ON admin_users((1));
