-- Waitlist users
CREATE TABLE IF NOT EXISTS waitlist_users (
    id                   BIGSERIAL PRIMARY KEY,
    email                TEXT UNIQUE NOT NULL,
    email_verified       BOOLEAN NOT NULL DEFAULT false,
    name                 TEXT NOT NULL DEFAULT '',
    role                 TEXT NOT NULL DEFAULT '',
    experience           TEXT NOT NULL DEFAULT '',
    twitter              TEXT NOT NULL DEFAULT '',
    discord              TEXT NOT NULL DEFAULT '',
    wallet               TEXT NOT NULL DEFAULT '',
    status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','invited','active','rejected')),
    referral_code        TEXT UNIQUE NOT NULL,
    referred_by          TEXT,
    source               TEXT NOT NULL DEFAULT '',
    utm_source           TEXT NOT NULL DEFAULT '',
    utm_medium           TEXT NOT NULL DEFAULT '',
    utm_campaign         TEXT NOT NULL DEFAULT '',
    utm_term             TEXT NOT NULL DEFAULT '',
    ip_hash              TEXT NOT NULL DEFAULT '',
    user_agent           TEXT NOT NULL DEFAULT '',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_at          TIMESTAMPTZ,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_waitlist_users_email       ON waitlist_users (email);
CREATE INDEX idx_waitlist_users_verified    ON waitlist_users (email_verified, created_at);
CREATE INDEX idx_waitlist_users_referral    ON waitlist_users (referral_code);

-- Verification tokens (double opt-in)
CREATE TABLE IF NOT EXISTS verification_tokens (
    id              BIGSERIAL PRIMARY KEY,
    email           TEXT NOT NULL,
    token           TEXT UNIQUE NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    used            BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_verification_tokens_token ON verification_tokens (token);
CREATE INDEX idx_verification_tokens_email ON verification_tokens (email);
