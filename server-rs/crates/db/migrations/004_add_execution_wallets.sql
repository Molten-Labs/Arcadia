CREATE TABLE IF NOT EXISTS execution_wallet (
    profile         TEXT PRIMARY KEY REFERENCES trader_profile(profile),
    pubkey          TEXT NOT NULL,
    encrypted_seed  BYTEA NOT NULL,
    encryption_salt BYTEA NOT NULL,
    status          SMALLINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
