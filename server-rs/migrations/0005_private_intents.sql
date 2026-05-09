CREATE TABLE IF NOT EXISTS private_intent_events (
    id BIGSERIAL PRIMARY KEY,
    event_key TEXT UNIQUE,
    vault_config_pubkey TEXT NOT NULL,
    intent_id TEXT NOT NULL,
    trader TEXT NOT NULL DEFAULT '',
    commitment_hash TEXT NOT NULL,
    status TEXT NOT NULL,
    guard_decision TEXT,
    executor TEXT NOT NULL DEFAULT 'magicblock-er',
    er_session TEXT,
    er_commitment TEXT,
    risk_limits JSONB NOT NULL DEFAULT '{}'::jsonb,
    settlement_signature TEXT,
    junior_delta DOUBLE PRECISION NOT NULL DEFAULT 0,
    senior_delta DOUBLE PRECISION NOT NULL DEFAULT 0,
    public_summary TEXT NOT NULL DEFAULT '',
    occurred_at BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_private_intents_vault_time
    ON private_intent_events(vault_config_pubkey, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_private_intents_intent_time
    ON private_intent_events(intent_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS private_intents (
    intent_id TEXT PRIMARY KEY,
    client_request_id TEXT,
    manager_pubkey TEXT NOT NULL,
    vault_config_pubkey TEXT NOT NULL,
    intent_type TEXT NOT NULL,
    status TEXT NOT NULL,
    executor TEXT NOT NULL,
    executor_request_id TEXT,
    request_hash TEXT NOT NULL,
    redacted_request JSONB NOT NULL,
    response_hash TEXT,
    redacted_response JSONB,
    signature TEXT,
    error TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_private_intent_records_manager_time
    ON private_intents(manager_pubkey, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_private_intent_records_vault_time
    ON private_intents(vault_config_pubkey, created_at DESC);

CREATE TABLE IF NOT EXISTS proof_events (
    event_id TEXT PRIMARY KEY,
    intent_id TEXT NOT NULL REFERENCES private_intents(intent_id) ON DELETE CASCADE,
    vault_config_pubkey TEXT NOT NULL,
    stage TEXT NOT NULL,
    status TEXT NOT NULL,
    executor TEXT NOT NULL,
    proof_hash TEXT NOT NULL,
    redacted_payload JSONB NOT NULL,
    occurred_at BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proof_events_intent_time
    ON proof_events(intent_id, occurred_at ASC);

CREATE INDEX IF NOT EXISTS idx_proof_events_vault_time
    ON proof_events(vault_config_pubkey, occurred_at DESC);
