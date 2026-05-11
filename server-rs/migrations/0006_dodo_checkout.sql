CREATE TABLE IF NOT EXISTS dodo_products (
    plan_kind TEXT PRIMARY KEY,
    product_id TEXT NOT NULL UNIQUE,
    environment TEXT NOT NULL DEFAULT 'test_mode',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dodo_checkout_sessions (
    session_id TEXT PRIMARY KEY,
    checkout_url TEXT,
    wallet TEXT NOT NULL,
    bot_id TEXT NOT NULL,
    plan_kind TEXT NOT NULL,
    product_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'created',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dodo_checkout_sessions_wallet
    ON dodo_checkout_sessions (wallet);

CREATE INDEX IF NOT EXISTS idx_dodo_checkout_sessions_bot_id
    ON dodo_checkout_sessions (bot_id);
