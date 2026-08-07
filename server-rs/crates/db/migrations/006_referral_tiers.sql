-- Referral tiers: cached verified-referral count per waitlist user.
-- Only email-verified signups (Privy OTP) count toward the referrer's count.
ALTER TABLE waitlist_users ADD COLUMN IF NOT EXISTS referral_count INT NOT NULL DEFAULT 0;

-- Backfill from existing verified referrals.
UPDATE waitlist_users u
SET referral_count = (
    SELECT COUNT(*)
    FROM waitlist_users r
    WHERE r.referred_by = u.referral_code AND r.email_verified
);

CREATE INDEX IF NOT EXISTS idx_waitlist_users_referred_by ON waitlist_users (referred_by);
