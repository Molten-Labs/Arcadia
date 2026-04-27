CREATE TABLE IF NOT EXISTS raw_events (
    id BIGSERIAL PRIMARY KEY,
    event_key TEXT UNIQUE,
    kind TEXT,
    payload JSONB NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS manager_profiles (
    pubkey TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    total_vaults INTEGER NOT NULL DEFAULT 0,
    active_vaults INTEGER NOT NULL DEFAULT 0,
    total_junior_deposited DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vaults (
    config_pubkey TEXT PRIMARY KEY,
    state_pubkey TEXT NOT NULL DEFAULT '',
    treasury_pubkey TEXT NOT NULL DEFAULT '',
    manager_pubkey TEXT NOT NULL DEFAULT '',
    manager_profile_pubkey TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'paper',
    tvl DOUBLE PRECISION NOT NULL DEFAULT 0,
    junior_capital DOUBLE PRECISION NOT NULL DEFAULT 0,
    senior_capital DOUBLE PRECISION NOT NULL DEFAULT 0,
    junior_shares_outstanding DOUBLE PRECISION NOT NULL DEFAULT 0,
    senior_shares_outstanding DOUBLE PRECISION NOT NULL DEFAULT 0,
    junior_health DOUBLE PRECISION NOT NULL DEFAULT 0,
    current_nav DOUBLE PRECISION NOT NULL DEFAULT 0,
    high_water_mark DOUBLE PRECISION NOT NULL DEFAULT 0,
    fee_bps INTEGER NOT NULL DEFAULT 0,
    max_slippage_bps INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL DEFAULT 0,
    graduated_at BIGINT NOT NULL DEFAULT 0,
    paper_trade_count INTEGER NOT NULL DEFAULT 0,
    min_qualifying_trades INTEGER NOT NULL DEFAULT 0,
    rolling24h_loss_bps INTEGER NOT NULL DEFAULT 0,
    rolling7d_loss_bps INTEGER NOT NULL DEFAULT 0,
    trading_enabled BOOLEAN NOT NULL DEFAULT true,
    instant_exit BOOLEAN NOT NULL DEFAULT false,
    vault_index INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vaults_manager_pubkey ON vaults(manager_pubkey);
CREATE INDEX IF NOT EXISTS idx_vaults_manager_profile_pubkey ON vaults(manager_profile_pubkey);

CREATE TABLE IF NOT EXISTS investor_positions (
    pubkey TEXT PRIMARY KEY,
    vault_config_pubkey TEXT NOT NULL,
    investor_pubkey TEXT NOT NULL,
    deposited_at BIGINT NOT NULL DEFAULT 0,
    senior_shares DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_deposited DOUBLE PRECISION NOT NULL DEFAULT 0,
    alert_threshold_bps INTEGER NOT NULL DEFAULT 2000,
    current_value DOUBLE PRECISION NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investor_positions_wallet ON investor_positions(investor_pubkey);
CREATE INDEX IF NOT EXISTS idx_investor_positions_vault ON investor_positions(vault_config_pubkey);

CREATE TABLE IF NOT EXISTS nav_points (
    id BIGSERIAL PRIMARY KEY,
    event_key TEXT UNIQUE,
    vault_config_pubkey TEXT NOT NULL,
    recorded_at BIGINT NOT NULL,
    nav DOUBLE PRECISION NOT NULL,
    junior_capital DOUBLE PRECISION NOT NULL DEFAULT 0,
    senior_capital DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nav_points_vault_time ON nav_points(vault_config_pubkey, recorded_at);

CREATE TABLE IF NOT EXISTS trade_events (
    id BIGSERIAL PRIMARY KEY,
    event_key TEXT UNIQUE,
    vault_config_pubkey TEXT NOT NULL,
    occurred_at BIGINT NOT NULL,
    visibility_after BIGINT NOT NULL,
    is_public_visible BOOLEAN NOT NULL DEFAULT false,
    side TEXT NOT NULL DEFAULT 'swap',
    size DOUBLE PRECISION NOT NULL DEFAULT 0,
    route TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trade_events_public ON trade_events(vault_config_pubkey, visibility_after, is_public_visible);

CREATE TABLE IF NOT EXISTS status_events (
    id BIGSERIAL PRIMARY KEY,
    event_key TEXT UNIQUE,
    vault_config_pubkey TEXT NOT NULL,
    occurred_at BIGINT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_status_events_vault_time ON status_events(vault_config_pubkey, occurred_at);
