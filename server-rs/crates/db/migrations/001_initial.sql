-- =============================================================================
-- Arcadia — initial schema (Postgres + TimescaleDB)
-- =============================================================================
-- All USD / share / PnL columns are NUMERIC (mapped to rust_decimal::Decimal).
-- Onchain amounts are USDC minor units (6 decimals); NAV scaled by 1e6.
-- =============================================================================

-- ── trader_profile (vault: one per trader; mirrors the PDA) ──────────────────
CREATE TABLE IF NOT EXISTS trader_profile (
    profile             TEXT PRIMARY KEY,
    trader              TEXT NOT NULL,
    handle              TEXT UNIQUE NOT NULL,
    status              SMALLINT NOT NULL DEFAULT 0,
    score_tier          SMALLINT NOT NULL DEFAULT 0,
    total_shares        NUMERIC NOT NULL DEFAULT 0,
    trader_shares       NUMERIC NOT NULL DEFAULT 0,
    nav_per_share       NUMERIC NOT NULL DEFAULT 1,
    hwm_per_share       NUMERIC NOT NULL DEFAULT 1,
    capacity_cap_usd    NUMERIC NOT NULL DEFAULT 0,
    trader_claimable    NUMERIC NOT NULL DEFAULT 0,
    max_leverage        NUMERIC NOT NULL DEFAULT 0,
    aum_usd             NUMERIC NOT NULL DEFAULT 0,
    trader_self_funded  BOOLEAN NOT NULL DEFAULT false,
    deposits_open       BOOLEAN NOT NULL DEFAULT true,
    investors_count     INT NOT NULL DEFAULT 0,
    style_tags          TEXT[] NOT NULL DEFAULT '{}',
    api_key_hash        TEXT,
    initialized_at      TIMESTAMPTZ NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── investor_account (one per investor wallet) ────────────────────────────────
CREATE TABLE IF NOT EXISTS investor_account (
    owner               TEXT PRIMARY KEY,
    position_count      INT NOT NULL DEFAULT 0,
    total_deposited_usd NUMERIC NOT NULL DEFAULT 0,
    initialized_at      TIMESTAMPTZ NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── investor_position (one per investor × trader_profile) ─────────────────────
CREATE TABLE IF NOT EXISTS investor_position (
    owner                   TEXT NOT NULL,
    profile                 TEXT NOT NULL,
    shares                  NUMERIC NOT NULL DEFAULT 0,
    cost_basis_usd          NUMERIC NOT NULL DEFAULT 0,
    pending_withdraw_shares NUMERIC NOT NULL DEFAULT 0,
    withdraw_ready_ts       TIMESTAMPTZ,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (owner, profile)
);

CREATE INDEX IF NOT EXISTS idx_investor_position_profile ON investor_position (profile);
CREATE INDEX IF NOT EXISTS idx_investor_position_owner   ON investor_position (owner);

-- ── trade (decoded TradeClosed events) — TimescaleDB hypertable ───────────────
CREATE TABLE IF NOT EXISTS trade (
    signature      TEXT    NOT NULL,
    event_index    INT     NOT NULL,
    slot           BIGINT  NOT NULL,
    profile        TEXT    NOT NULL,
    trader         TEXT    NOT NULL,
    market         TEXT    NOT NULL,
    direction      SMALLINT NOT NULL,
    size_usd       NUMERIC NOT NULL,
    leverage_x     NUMERIC NOT NULL,
    entry_px       NUMERIC NOT NULL,
    exit_px        NUMERIC NOT NULL,
    realized_pnl   NUMERIC NOT NULL,
    fees_usd       NUMERIC NOT NULL,
    was_liquidated BOOLEAN NOT NULL,
    opened_at      TIMESTAMPTZ NOT NULL,
    closed_at      TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (signature, event_index)
);

CREATE INDEX IF NOT EXISTS idx_trade_profile_closed ON trade (profile, closed_at DESC);

-- Convert to hypertable only if TimescaleDB is available
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'
    ) THEN
        PERFORM create_hypertable('trade', 'closed_at', if_not_exists => TRUE);
    END IF;
END $$;

-- ── flow (Deposited / Withdrawn — drives TWR) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS flow (
    signature      TEXT    NOT NULL,
    event_index    INT     NOT NULL,
    slot           BIGINT  NOT NULL,
    profile        TEXT    NOT NULL,
    owner          TEXT    NOT NULL,
    is_trader      BOOLEAN NOT NULL DEFAULT false,
    kind           TEXT    NOT NULL, -- 'deposit' | 'withdraw'
    amount_usd     NUMERIC NOT NULL,
    shares         NUMERIC NOT NULL,
    nav_per_share  NUMERIC NOT NULL,
    ts             TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (signature, event_index)
);

CREATE INDEX IF NOT EXISTS idx_flow_profile_ts ON flow (profile, ts);
CREATE INDEX IF NOT EXISTS idx_flow_owner       ON flow (owner, profile);

-- ── equity_point (daily TWR curve, computed by score worker) — hypertable ─────
CREATE TABLE IF NOT EXISTS equity_point (
    profile    TEXT    NOT NULL,
    day        DATE    NOT NULL,
    twr_nav    NUMERIC NOT NULL, -- TWR equity index (starts at 1.0)
    aum_usd    NUMERIC NOT NULL,
    PRIMARY KEY (profile, day)
);

CREATE INDEX IF NOT EXISTS idx_equity_point_profile ON equity_point (profile, day DESC);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'
    ) THEN
        BEGIN
            PERFORM create_hypertable(
                'equity_point', 'day',
                partitioning_column => 'profile',
                number_partitions   => 4,
                if_not_exists       => TRUE
            );
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;
END $$;

-- ── score_snapshot (written by score worker, hourly) ──────────────────────────
CREATE TABLE IF NOT EXISTS score_snapshot (
    id              BIGSERIAL PRIMARY KEY,
    profile         TEXT        NOT NULL,
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    score           INT         NOT NULL,
    tier            TEXT,
    confidence      NUMERIC     NOT NULL,
    ci_low          NUMERIC     NOT NULL,
    ci_high         NUMERIC     NOT NULL,
    capacity_usd    NUMERIC     NOT NULL,
    sortino         NUMERIC     NOT NULL,
    calmar          NUMERIC     NOT NULL,
    max_dd          NUMERIC     NOT NULL,
    ulcer           NUMERIC     NOT NULL,
    liq_rate        NUMERIC     NOT NULL,
    pct_profitable  NUMERIC     NOT NULL,
    avg_leverage    NUMERIC     NOT NULL,
    trade_count     INT         NOT NULL,
    days_active     INT         NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_score_snapshot_profile ON score_snapshot (profile, computed_at DESC);

-- ── ingest_cursor (slot resume for ingest worker) ────────────────────────────
CREATE TABLE IF NOT EXISTS ingest_cursor (
    id          INT PRIMARY KEY DEFAULT 1,
    last_slot   BIGINT NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
