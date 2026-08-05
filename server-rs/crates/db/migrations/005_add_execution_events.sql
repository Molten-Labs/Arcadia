-- =============================================================================
-- Execution event log — the authoritative, append-only source of fills.
--
-- The `trade` table below is a *cache* of authoritative execution events.
-- Rows in `trade` may only be created via record_fill (the execution pipeline),
-- never from public HTTP. Every fill is traceable to the event that produced it.
-- =============================================================================

CREATE TABLE IF NOT EXISTS execution_event (
    id               BIGSERIAL PRIMARY KEY,
    profile          TEXT NOT NULL,
    venue            TEXT NOT NULL,             -- 'flashtrade'
    execution_wallet TEXT NOT NULL,             -- base58 of the execution wallet
    market           TEXT NOT NULL,
    position_id      TEXT NOT NULL,             -- venue position/order id
    fill_signature   TEXT NOT NULL,             -- venue/on-chain tx signature
    event_type       TEXT NOT NULL,             -- 'open' | 'close' | 'sweep'
    payload          JSONB NOT NULL,            -- raw venue payload (pre-normalization)
    recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (venue, position_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_execution_event_profile
    ON execution_event (profile, recorded_at DESC);

-- ── Provenance columns on trade (the scoring cache) ───────────────────────────
-- Every trade written by the execution pipeline carries its origin. Rows from
-- the pre-pipeline era (simulate / frontend events) remain but are flagged.
ALTER TABLE trade
    ADD COLUMN IF NOT EXISTS venue            TEXT,
    ADD COLUMN IF NOT EXISTS execution_wallet TEXT,
    ADD COLUMN IF NOT EXISTS position_id      TEXT,
    ADD COLUMN IF NOT EXISTS fill_signature   TEXT,
    ADD COLUMN IF NOT EXISTS source           TEXT NOT NULL DEFAULT 'legacy';

CREATE INDEX IF NOT EXISTS idx_trade_source ON trade (source);
