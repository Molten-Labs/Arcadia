use crate::models::*;
use anyhow::Result;
use rust_decimal::Decimal;
use sqlx::PgPool;

// ── TraderProfile ─────────────────────────────────────────────────────────────

const TRADER_PROFILE_COLS: &str = "id, profile, trader, handle, status, score_tier,
    total_shares, trader_shares, nav_per_share, hwm_per_share,
    capacity_cap_usd, trader_claimable, max_leverage, aum_usd,
    trader_self_funded, deposits_open, investors_count,
    style_tags, api_key_hash, initialized_at, updated_at";

pub async fn get_trader_by_handle(pool: &PgPool, handle: &str) -> Result<Option<DbTraderProfile>> {
    Ok(sqlx::query_as::<_, DbTraderProfile>(&format!(
        "SELECT {TRADER_PROFILE_COLS} FROM trader_profile WHERE handle = $1"
    ))
    .bind(handle)
    .fetch_optional(pool)
    .await?)
}

pub async fn get_trader_by_profile(pool: &PgPool, profile: &str) -> Result<Option<DbTraderProfile>> {
    Ok(sqlx::query_as::<_, DbTraderProfile>(&format!(
        "SELECT {TRADER_PROFILE_COLS} FROM trader_profile WHERE profile = $1"
    ))
    .bind(profile)
    .fetch_optional(pool)
    .await?)
}

pub async fn list_traders(pool: &PgPool) -> Result<Vec<DbTraderProfile>> {
    Ok(sqlx::query_as::<_, DbTraderProfile>(&format!(
        "SELECT {TRADER_PROFILE_COLS} FROM trader_profile ORDER BY aum_usd DESC"
    ))
    .fetch_all(pool)
    .await?)
}

pub async fn list_traders_paginated(pool: &PgPool, limit: i64) -> Result<Vec<DbTraderProfile>> {
    Ok(sqlx::query_as::<_, DbTraderProfile>(&format!(
        "SELECT {TRADER_PROFILE_COLS} FROM trader_profile ORDER BY aum_usd DESC LIMIT $1"
    ))
    .bind(limit)
    .fetch_all(pool)
    .await?)
}

pub async fn upsert_trader_profile(
    pool: &PgPool,
    profile: &str,
    trader: &str,
    handle: &str,
    initialized_at: chrono::DateTime<chrono::Utc>,
) -> Result<()> {
    sqlx::query(
        "INSERT INTO trader_profile (profile, trader, handle, initialized_at, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (profile) DO UPDATE SET updated_at = now()",
    )
    .bind(profile)
    .bind(trader)
    .bind(handle)
    .bind(initialized_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn update_trader_scores(
    pool: &PgPool,
    profile: &str,
    score_tier: &str,
    aum_usd: Decimal,
) -> Result<()> {
    sqlx::query(
        "UPDATE trader_profile SET score_tier = $2, aum_usd = $3, updated_at = now()
         WHERE profile = $1",
    )
    .bind(profile)
    .bind(score_tier)
    .bind(aum_usd)
    .execute(pool)
    .await?;
    Ok(())
}

// ── Trades ────────────────────────────────────────────────────────────────────

const TRADE_COLS: &str = "signature, event_index, slot, profile, trader, market,
    direction, size_usd, leverage_x, entry_px, exit_px,
    realized_pnl, fees_usd, was_liquidated, opened_at, closed_at";

pub async fn get_vault_trades(
    pool: &PgPool,
    profile: &str,
    limit: i64,
    before: Option<chrono::DateTime<chrono::Utc>>,
) -> Result<Vec<DbTrade>> {
    let rows = if let Some(before) = before {
        sqlx::query_as::<_, DbTrade>(&format!(
            "SELECT {TRADE_COLS} FROM trade
             WHERE profile = $1 AND closed_at < $2
             ORDER BY closed_at DESC LIMIT $3"
        ))
        .bind(profile)
        .bind(before)
        .bind(limit)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<_, DbTrade>(&format!(
            "SELECT {TRADE_COLS} FROM trade
             WHERE profile = $1
             ORDER BY closed_at DESC LIMIT $2"
        ))
        .bind(profile)
        .bind(limit)
        .fetch_all(pool)
        .await?
    };
    Ok(rows)
}

pub async fn get_all_trades_for_profile(pool: &PgPool, profile: &str) -> Result<Vec<DbTrade>> {
    Ok(sqlx::query_as::<_, DbTrade>(&format!(
        "SELECT {TRADE_COLS} FROM trade WHERE profile = $1 ORDER BY closed_at ASC"
    ))
    .bind(profile)
    .fetch_all(pool)
    .await?)
}

pub async fn get_trades_since(
    pool: &PgPool,
    profile: &str,
    since: chrono::DateTime<chrono::Utc>,
) -> Result<Vec<DbTrade>> {
    Ok(sqlx::query_as::<_, DbTrade>(&format!(
        "SELECT {TRADE_COLS} FROM trade WHERE profile = $1 AND closed_at >= $2 ORDER BY closed_at ASC"
    ))
    .bind(profile)
    .bind(since)
    .fetch_all(pool)
    .await?)
}

pub async fn get_trader_profiles_batch(
    pool: &PgPool,
    profiles: &[&str],
) -> Result<Vec<DbTraderProfile>> {
    if profiles.is_empty() {
        return Ok(Vec::new());
    }
    let params: Vec<String> = profiles.iter().enumerate().map(|(i, _)| format!("${}", i + 1)).collect();
    let sql = format!(
        "SELECT {TRADER_PROFILE_COLS} FROM trader_profile WHERE profile IN ({})",
        params.join(",")
    );
    let mut query = sqlx::query_as::<_, DbTraderProfile>(&sql);
    for p in profiles {
        query = query.bind(p);
    }
    Ok(query.fetch_all(pool).await?)
}

pub async fn insert_trade(pool: &PgPool, t: &DbTrade) -> Result<()> {
    sqlx::query(
        "INSERT INTO trade (
             signature, event_index, slot, profile, trader, market,
             direction, size_usd, leverage_x, entry_px, exit_px,
             realized_pnl, fees_usd, was_liquidated, opened_at, closed_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (signature, event_index) DO NOTHING",
    )
    .bind(&t.signature)
    .bind(t.event_index)
    .bind(t.slot)
    .bind(&t.profile)
    .bind(&t.trader)
    .bind(&t.market)
    .bind(t.direction)
    .bind(t.size_usd)
    .bind(t.leverage_x)
    .bind(t.entry_px)
    .bind(t.exit_px)
    .bind(t.realized_pnl)
    .bind(t.fees_usd)
    .bind(t.was_liquidated)
    .bind(t.opened_at)
    .bind(t.closed_at)
    .execute(pool)
    .await?;
    Ok(())
}

// ── Flows ─────────────────────────────────────────────────────────────────────

const FLOW_COLS: &str = "signature, event_index, slot, profile, owner, is_trader,
    kind, amount_usd, shares, nav_per_share, ts";

pub async fn upsert_investor_account(
    pool: &PgPool,
    owner: &str,
    initialized_at: chrono::DateTime<chrono::Utc>,
) -> Result<()> {
    sqlx::query(
        "INSERT INTO investor_account (owner, position_count, total_deposited_usd, initialized_at, updated_at)
         VALUES ($1, 0, 0, $2, now())
         ON CONFLICT (owner) DO UPDATE SET updated_at = now()",
    )
    .bind(owner)
    .bind(initialized_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn upsert_investor_position(
    pool: &PgPool,
    owner: &str,
    profile: &str,
    shares: Decimal,
    cost_basis_usd: Decimal,
) -> Result<()> {
    sqlx::query(
        "INSERT INTO investor_position (owner, profile, shares, cost_basis_usd, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (owner, profile) DO UPDATE
             SET shares = investor_position.shares + EXCLUDED.shares,
                 cost_basis_usd = investor_position.cost_basis_usd + EXCLUDED.cost_basis_usd,
                 updated_at = now()",
    )
    .bind(owner)
    .bind(profile)
    .bind(shares)
    .bind(cost_basis_usd)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn insert_flow(pool: &PgPool, f: &DbFlow) -> Result<()> {
    sqlx::query(
        "INSERT INTO flow (
             signature, event_index, slot, profile, owner, is_trader,
             kind, amount_usd, shares, nav_per_share, ts
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (signature, event_index) DO NOTHING",
    )
    .bind(&f.signature)
    .bind(f.event_index)
    .bind(f.slot)
    .bind(&f.profile)
    .bind(&f.owner)
    .bind(f.is_trader)
    .bind(&f.kind)
    .bind(f.amount_usd)
    .bind(f.shares)
    .bind(f.nav_per_share)
    .bind(f.ts)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_flows_for_profile(pool: &PgPool, profile: &str) -> Result<Vec<DbFlow>> {
    Ok(sqlx::query_as::<_, DbFlow>(&format!(
        "SELECT {FLOW_COLS} FROM flow WHERE profile = $1 ORDER BY ts ASC"
    ))
    .bind(profile)
    .fetch_all(pool)
    .await?)
}

pub async fn get_flows_for_profile_paginated(
    pool: &PgPool,
    profile: &str,
    limit: i64,
) -> Result<Vec<DbFlow>> {
    Ok(sqlx::query_as::<_, DbFlow>(&format!(
        "SELECT {FLOW_COLS} FROM flow WHERE profile = $1 ORDER BY ts DESC LIMIT $2"
    ))
    .bind(profile)
    .bind(limit)
    .fetch_all(pool)
    .await?)
}

// ── Equity points ─────────────────────────────────────────────────────────────

pub async fn upsert_equity_point(pool: &PgPool, ep: &DbEquityPoint) -> Result<()> {
    sqlx::query(
        "INSERT INTO equity_point (profile, day, twr_nav, aum_usd)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (profile, day) DO UPDATE
             SET twr_nav = EXCLUDED.twr_nav, aum_usd = EXCLUDED.aum_usd",
    )
    .bind(&ep.profile)
    .bind(ep.day)
    .bind(ep.twr_nav)
    .bind(ep.aum_usd)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_equity_curve(pool: &PgPool, profile: &str) -> Result<Vec<DbEquityPoint>> {
    Ok(sqlx::query_as::<_, DbEquityPoint>(
        "SELECT profile, day, twr_nav, aum_usd
         FROM equity_point WHERE profile = $1 ORDER BY day ASC",
    )
    .bind(profile)
    .fetch_all(pool)
    .await?)
}

// ── Score snapshots ───────────────────────────────────────────────────────────

pub async fn insert_score_snapshot(pool: &PgPool, s: &DbScoreSnapshot) -> Result<()> {
    sqlx::query(
        "INSERT INTO score_snapshot (
             profile, computed_at, score, tier, confidence, ci_low, ci_high,
             capacity_usd, sortino, calmar, max_dd, ulcer, liq_rate,
             pct_profitable, avg_leverage, trade_count, days_active
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)",
    )
    .bind(&s.profile)
    .bind(s.computed_at)
    .bind(s.score)
    .bind(&s.tier)
    .bind(s.confidence)
    .bind(s.ci_low)
    .bind(s.ci_high)
    .bind(s.capacity_usd)
    .bind(s.sortino)
    .bind(s.calmar)
    .bind(s.max_dd)
    .bind(s.ulcer)
    .bind(s.liq_rate)
    .bind(s.pct_profitable)
    .bind(s.avg_leverage)
    .bind(s.trade_count)
    .bind(s.days_active)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn latest_score(pool: &PgPool, profile: &str) -> Result<Option<DbScoreSnapshot>> {
    Ok(sqlx::query_as::<_, DbScoreSnapshot>(
        "SELECT profile, computed_at, score, tier, confidence, ci_low, ci_high,
                capacity_usd, sortino, calmar, max_dd, ulcer, liq_rate,
                pct_profitable, avg_leverage, trade_count, days_active
         FROM score_snapshot
         WHERE profile = $1
         ORDER BY computed_at DESC LIMIT 1",
    )
    .bind(profile)
    .fetch_optional(pool)
    .await?)
}

pub async fn score_history(
    pool: &PgPool,
    profile: &str,
    limit: i64,
) -> Result<Vec<DbScoreSnapshot>> {
    Ok(sqlx::query_as::<_, DbScoreSnapshot>(
        "SELECT profile, computed_at, score, tier, confidence, ci_low, ci_high,
                capacity_usd, sortino, calmar, max_dd, ulcer, liq_rate,
                pct_profitable, avg_leverage, trade_count, days_active
         FROM score_snapshot
         WHERE profile = $1
         ORDER BY computed_at DESC LIMIT $2",
    )
    .bind(profile)
    .bind(limit)
    .fetch_all(pool)
    .await?)
}

// ── Investor ──────────────────────────────────────────────────────────────────

pub async fn get_investor_account(pool: &PgPool, owner: &str) -> Result<Option<DbInvestorAccount>> {
    Ok(sqlx::query_as::<_, DbInvestorAccount>(
        "SELECT id, owner, position_count, total_deposited_usd, initialized_at, updated_at
         FROM investor_account WHERE owner = $1",
    )
    .bind(owner)
    .fetch_optional(pool)
    .await?)
}

pub async fn get_investor_positions(pool: &PgPool, owner: &str) -> Result<Vec<DbInvestorPosition>> {
    Ok(sqlx::query_as::<_, DbInvestorPosition>(
        "SELECT owner, profile, shares, cost_basis_usd,
                pending_withdraw_shares, withdraw_ready_ts, updated_at
         FROM investor_position WHERE owner = $1",
    )
    .bind(owner)
    .fetch_all(pool)
    .await?)
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

pub async fn leaderboard_by_score(pool: &PgPool, limit: i64) -> Result<Vec<(String, i32, String)>> {
    #[derive(sqlx::FromRow)]
    struct Row {
        handle: String,
        score: i32,
        tier: Option<String>,
    }

    let rows = sqlx::query_as::<_, Row>(
        "SELECT tp.handle, ss.score, COALESCE(ss.tier, 'Unranked') AS tier
         FROM trader_profile tp
         JOIN LATERAL (
             SELECT score, tier FROM score_snapshot
             WHERE profile = tp.profile
             ORDER BY computed_at DESC LIMIT 1
         ) ss ON true
         WHERE ss.score >= 100
         ORDER BY ss.score DESC LIMIT $1",
    )
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| (r.handle, r.score, r.tier.unwrap_or_default()))
        .collect())
}

pub async fn leaderboard_by_return(pool: &PgPool, limit: i64) -> Result<Vec<(String, Decimal)>> {
    #[derive(sqlx::FromRow)]
    struct Row {
        handle: String,
        return_30d: Option<Decimal>,
    }

    let rows = sqlx::query_as::<_, Row>(
        "SELECT tp.handle,
                (ep_now.twr_nav - ep_30d.twr_nav) / NULLIF(ep_30d.twr_nav, 0) AS return_30d
         FROM trader_profile tp
         JOIN LATERAL (
             SELECT twr_nav FROM equity_point
             WHERE profile = tp.profile ORDER BY day DESC LIMIT 1
         ) ep_now ON true
         JOIN LATERAL (
             SELECT twr_nav FROM equity_point
             WHERE profile = tp.profile AND day <= now()::date - interval '30 days'
             ORDER BY day DESC LIMIT 1
         ) ep_30d ON true
         ORDER BY return_30d DESC NULLS LAST LIMIT $1",
    )
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .filter_map(|r| r.return_30d.map(|ret| (r.handle, ret)))
        .collect())
}

// ── Ingest cursor ─────────────────────────────────────────────────────────────

pub async fn get_ingest_cursor(pool: &PgPool) -> Result<i64> {
    let row: Option<(i64,)> = sqlx::query_as(
        "SELECT last_slot FROM ingest_cursor WHERE id = 1",
    )
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|r| r.0).unwrap_or(0))
}

pub async fn set_ingest_cursor(pool: &PgPool, slot: i64) -> Result<()> {
    sqlx::query(
        "INSERT INTO ingest_cursor (id, last_slot, updated_at) VALUES (1, $1, now())
         ON CONFLICT (id) DO UPDATE SET last_slot = $1, updated_at = now()",
    )
    .bind(slot)
    .execute(pool)
    .await?;
    Ok(())
}

// ── NAV snapshots (for investor portfolio) ────────────────────────────────────

pub async fn get_nav_history(
    pool: &PgPool,
    profile: &str,
    days: i64,
) -> Result<Vec<DbEquityPoint>> {
    Ok(sqlx::query_as::<_, DbEquityPoint>(
        "SELECT profile, day, twr_nav, aum_usd
         FROM equity_point
         WHERE profile = $1 AND day >= now()::date - ($2::int || ' days')::interval
         ORDER BY day ASC",
    )
    .bind(profile)
    .bind(days)
    .fetch_all(pool)
    .await?)
}

// ── Investor flows (deposits, withdrawals, settlements by owner) ──────────────

pub async fn get_trader_by_wallet(pool: &PgPool, wallet: &str) -> Result<Option<DbTraderProfile>> {
    Ok(sqlx::query_as::<_, DbTraderProfile>(&format!(
        "SELECT {TRADER_PROFILE_COLS} FROM trader_profile WHERE trader = $1"
    ))
    .bind(wallet)
    .fetch_optional(pool)
    .await?)
}

pub async fn get_flows_for_profile_and_trader(
    pool: &PgPool,
    profile: &str,
    limit: i64,
) -> Result<Vec<DbFlow>> {
    Ok(sqlx::query_as::<_, DbFlow>(
        "SELECT signature, event_index, slot, profile, owner, is_trader,
                kind, amount_usd, shares, nav_per_share, ts
         FROM flow
         WHERE profile = $1 AND is_trader = true AND kind = 'withdraw'
         ORDER BY ts DESC LIMIT $2",
    )
    .bind(profile)
    .bind(limit)
    .fetch_all(pool)
    .await?)
}

pub async fn set_deposits_open(pool: &PgPool, profile: &str, open: bool) -> Result<()> {
    sqlx::query(
        "UPDATE trader_profile SET deposits_open = $2, updated_at = now() WHERE profile = $1",
    )
    .bind(profile)
    .bind(open)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn toggle_deposits_open(pool: &PgPool, profile: &str) -> Result<bool> {
    let row: Option<(bool,)> = sqlx::query_as(
        "UPDATE trader_profile SET deposits_open = NOT deposits_open, updated_at = now()
         WHERE profile = $1
         RETURNING deposits_open",
    )
    .bind(profile)
    .fetch_optional(pool)
    .await?;
    row.map(|r| r.0).ok_or_else(|| anyhow::anyhow!("profile not found"))
}

pub async fn get_flows_for_owner(
    pool: &PgPool,
    owner: &str,
    limit: i64,
) -> Result<Vec<DbFlow>> {
    Ok(sqlx::query_as::<_, DbFlow>(
        "SELECT signature, event_index, slot, profile, owner, is_trader,
                kind, amount_usd, shares, nav_per_share, ts
         FROM flow
          WHERE owner = $1
         ORDER BY ts DESC LIMIT $2",
    )
    .bind(owner)
    .bind(limit)
    .fetch_all(pool)
    .await?)
}

// ── Waitlist ───────────────────────────────────────────────────────────────────

const DISPOSABLE_DOMAINS: &[&str] = &[
    "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
    "throwaway.io", "yopmail.com", "trashmail.com", "sharklasers.com",
    "maildrop.cc", "getairmail.com", "temp-mail.org", "fakeinbox.com",
    "emailondeck.com", "mailexpire.com", "mailsac.com",
];

pub fn is_disposable_email(email: &str) -> bool {
    let domain = email.split('@').nth(1).unwrap_or("").to_lowercase();
    DISPOSABLE_DOMAINS.iter().any(|d| domain == *d || domain.ends_with(&format!(".{d}")))
}

fn generate_referral_code() -> String {
    uuid::Uuid::new_v4().to_string()[..8].to_uppercase()
}

pub async fn insert_waitlist_user(
    pool: &PgPool,
    email: &str, name: &str, role: &str, experience: &str,
    twitter: &str, discord: &str, wallet: &str,
    referred_by: Option<&str>,
    source: &str,
    utm_source: &str, utm_medium: &str, utm_campaign: &str, utm_term: &str,
    ip_hash: &str, user_agent: &str,
) -> Result<Option<DbWaitlistUser>> {
    let code = generate_referral_code();
    Ok(sqlx::query_as::<_, DbWaitlistUser>(
        "INSERT INTO waitlist_users
            (email, name, role, experience, twitter, discord, wallet,
             referral_code, referred_by, source,
             utm_source, utm_medium, utm_campaign, utm_term,
             ip_hash, user_agent)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (email) DO NOTHING
         RETURNING *",
    )
    .bind(email).bind(name).bind(role).bind(experience)
    .bind(twitter).bind(discord).bind(wallet)
    .bind(&code).bind(referred_by).bind(source)
    .bind(utm_source).bind(utm_medium).bind(utm_campaign).bind(utm_term)
    .bind(ip_hash).bind(user_agent)
    .fetch_optional(pool)
    .await?)
}

pub async fn get_waitlist_user_by_email(pool: &PgPool, email: &str) -> Result<Option<DbWaitlistUser>> {
    Ok(sqlx::query_as::<_, DbWaitlistUser>(
        "SELECT * FROM waitlist_users WHERE email = $1"
    ).bind(email).fetch_optional(pool).await?)
}

pub async fn list_waitlist_users(pool: &PgPool) -> Result<Vec<DbWaitlistUser>> {
    Ok(sqlx::query_as::<_, DbWaitlistUser>(
        "SELECT * FROM waitlist_users ORDER BY created_at DESC"
    ).fetch_all(pool).await?)
}

/// Queue position (computed from created_at order, all users count).
pub async fn get_waitlist_position(pool: &PgPool, user_id: i64) -> Result<i64> {
    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM waitlist_users WHERE id < $1"
    ).bind(user_id).fetch_one(pool).await?;
    Ok(count.0 + 1)
}

// ── Execution Wallet ─────────────────────────────────────────────────────────

pub async fn get_execution_wallet(pool: &PgPool, profile: &str) -> Result<Option<DbExecutionWallet>> {
    Ok(sqlx::query_as::<_, DbExecutionWallet>(
        "SELECT * FROM execution_wallet WHERE profile = $1"
    )
    .bind(profile)
    .fetch_optional(pool)
    .await?)
}

pub async fn upsert_execution_wallet(
    pool: &PgPool,
    profile: &str,
    pubkey: &str,
    encrypted_seed: &[u8],
    encryption_salt: &[u8],
) -> Result<()> {
    sqlx::query(
        "INSERT INTO execution_wallet (profile, pubkey, encrypted_seed, encryption_salt, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (profile) DO UPDATE SET
             pubkey = $2,
             encrypted_seed = $3,
             encryption_salt = $4,
             updated_at = now()"
    )
    .bind(profile)
    .bind(pubkey)
    .bind(encrypted_seed)
    .bind(encryption_salt)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn update_execution_wallet_status(
    pool: &PgPool,
    profile: &str,
    status: i16,
) -> Result<()> {
    sqlx::query(
        "UPDATE execution_wallet SET status = $1, updated_at = now() WHERE profile = $2"
    )
    .bind(status)
    .bind(profile)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn list_execution_wallets_by_status(pool: &PgPool, status: i16) -> Result<Vec<DbExecutionWallet>> {
    Ok(sqlx::query_as::<_, DbExecutionWallet>(
        "SELECT * FROM execution_wallet WHERE status = $1"
    )
    .bind(status)
    .fetch_all(pool)
    .await?)
}

pub async fn verify_waitlist_user(pool: &PgPool, email: &str) -> Result<Option<DbWaitlistUser>> {
    Ok(sqlx::query_as::<_, DbWaitlistUser>(
        "UPDATE waitlist_users
         SET email_verified = true, status = 'verified', verified_at = COALESCE(verified_at, now()), updated_at = now()
         WHERE email = $1
         RETURNING *"
    ).bind(email).fetch_optional(pool).await?)
}
