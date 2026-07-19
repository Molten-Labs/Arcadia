-- Add UUID columns to user tables for idiomatic internal identifiers.
-- Existing TEXT PKs (profile PDA for traders, wallet for investors) remain
-- as unique natural keys; the UUID is an opaque internal identifier.

ALTER TABLE trader_profile
    ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid() NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trader_profile_id ON trader_profile (id);

ALTER TABLE investor_account
    ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid() NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_investor_account_id ON investor_account (id);
