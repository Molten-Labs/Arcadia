CREATE TABLE IF NOT EXISTS dodo_webhook_events (
    webhook_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_dodo_webhook_events_event_type
    ON dodo_webhook_events (event_type);

CREATE TABLE IF NOT EXISTS bot_subscriptions (
    subscription_id TEXT PRIMARY KEY,
    wallet TEXT NOT NULL,
    bot_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    status TEXT NOT NULL,
    current_period_end TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_subscriptions_wallet
    ON bot_subscriptions (wallet);

CREATE INDEX IF NOT EXISTS idx_bot_subscriptions_bot_id
    ON bot_subscriptions (bot_id);

CREATE TABLE IF NOT EXISTS bot_entitlements (
    wallet TEXT NOT NULL,
    bot_id TEXT NOT NULL,
    subscription_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT FALSE,
    reason TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (wallet, bot_id)
);

CREATE INDEX IF NOT EXISTS idx_bot_entitlements_wallet_active
    ON bot_entitlements (wallet, active);
