/// All /v1 route handlers.
use crate::{
    auth::verify_jwt,
    error::ApiError,
    state::AppState,
};
use arcadia_db::queries;
use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use serde_json::{json, Value};

// ── GET /v1/traders ───────────────────────────────────────────────────────────

pub async fn list_traders(State(ctx): State<AppState>) -> Result<Json<Value>, ApiError> {
    let traders = queries::list_traders(&ctx.db).await?;

    let mut list: Vec<Value> = Vec::with_capacity(traders.len());
    for t in &traders {
        let snap = queries::latest_score(&ctx.db, &t.profile).await.unwrap_or(None);
        list.push(json!({
            "handle":        t.handle,
            "wallet":        t.trader,
            "profile":       t.profile,
            "score":         snap.as_ref().map(|s| s.score).unwrap_or(0),
            "tier":          snap.as_ref().and_then(|s| s.tier.clone()).unwrap_or_else(|| "Unranked".into()),
            "confidence":    snap.as_ref().map(|s| s.confidence).unwrap_or(Decimal::ZERO),
            "capacity_usd":  t.capacity_cap_usd.to_string(),
            "aum_usd":       t.aum_usd.to_string(),
            "max_dd":        snap.as_ref().map(|s| s.max_dd).unwrap_or(Decimal::ZERO),
            "sortino":       snap.as_ref().map(|s| s.sortino).unwrap_or(Decimal::ZERO),
            "style_tags":    t.style_tags,
            "deposits_open": t.deposits_open,
        }));
    }
    Ok(Json(json!(list)))
}

// ── GET /v1/traders/:handle ───────────────────────────────────────────────────

pub async fn get_trader(
    State(ctx): State<AppState>,
    Path(handle): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let t = queries::get_trader_by_handle(&ctx.db, &handle)
        .await?
        .ok_or(ApiError::NotFound)?;

    let snap   = queries::latest_score(&ctx.db, &t.profile).await?;
    let curve  = queries::get_equity_curve(&ctx.db, &t.profile).await?;
    let trades = queries::get_vault_trades(&ctx.db, &t.profile, 50, None).await?;

    let equity_curve: Vec<Value> = curve.iter().map(|ep| json!({
        "day": ep.day.to_string(),
        "nav": ep.twr_nav,
    })).collect();

    let trade_list: Vec<Value> = trades.iter().map(|tr| json!({
        "market":         tr.market,
        "direction":      tr.direction,
        "size_usd":       tr.size_usd.to_string(),
        "leverage_x":     tr.leverage_x,
        "realized_pnl":   tr.realized_pnl.to_string(),
        "fees_usd":       tr.fees_usd.to_string(),
        "was_liquidated": tr.was_liquidated,
        "opened_at":      tr.opened_at,
        "closed_at":      tr.closed_at,
    })).collect();

    Ok(Json(json!({
        "wallet":    t.trader,
        "profile":   t.profile,
        "score":     snap.as_ref().map(|s| s.score).unwrap_or(0),
        "tier":      snap.as_ref().and_then(|s| s.tier.clone()).unwrap_or_else(|| "Unranked".into()),
        "confidence": snap.as_ref().map(|s| s.confidence).unwrap_or(Decimal::ZERO),
        "ci":        snap.as_ref().map(|s| [s.ci_low, s.ci_high]).unwrap_or([Decimal::ZERO; 2]),
        "metrics": {
            "sortino":        snap.as_ref().map(|s| s.sortino).unwrap_or(Decimal::ZERO),
            "calmar":         snap.as_ref().map(|s| s.calmar).unwrap_or(Decimal::ZERO),
            "max_dd":         snap.as_ref().map(|s| s.max_dd).unwrap_or(Decimal::ZERO),
            "liq_rate":       snap.as_ref().map(|s| s.liq_rate).unwrap_or(Decimal::ZERO),
            "pct_profitable": snap.as_ref().map(|s| s.pct_profitable).unwrap_or(Decimal::ZERO),
            "avg_leverage":   snap.as_ref().map(|s| s.avg_leverage).unwrap_or(Decimal::ZERO),
        },
        "equity_curve":       equity_curve,
        "trades":             trade_list,
        "capacity": {
            "total_usd": t.capacity_cap_usd.to_string(),
            "used_usd":  t.aum_usd.to_string(),
        },
        "aum_usd":            t.aum_usd.to_string(),
        "investors_count":    t.investors_count,
        "days_active":        curve.len() as i32,
        "trade_count":        trades.len() as i32,
        "trader_self_funded": t.trader_self_funded,
        "deposits_open":      t.deposits_open,
    })))
}

// ── GET /v1/vaults/:profile ───────────────────────────────────────────────────

pub async fn get_vault(
    State(ctx): State<AppState>,
    Path(profile): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let t = queries::get_trader_by_profile(&ctx.db, &profile)
        .await?
        .ok_or(ApiError::NotFound)?;

    Ok(Json(json!({
        "nav_per_share":      t.nav_per_share.to_string(),
        "total_shares":       t.total_shares.to_string(),
        "aum_usd":            t.aum_usd.to_string(),
        "hwm_per_share":      t.hwm_per_share.to_string(),
        "status":             t.status,
        "trader_shares":      t.trader_shares.to_string(),
        "capacity_usd":       t.capacity_cap_usd.to_string(),
        "trader_self_funded": t.trader_self_funded,
        "deposits_open":      t.deposits_open,
    })))
}

// ── GET /v1/vaults/:profile/trades ────────────────────────────────────────────

#[derive(Deserialize)]
pub struct TradesPagination {
    limit:  Option<i64>,
    before: Option<DateTime<Utc>>,
}

pub async fn get_vault_trades(
    State(ctx): State<AppState>,
    Path(profile): Path<String>,
    Query(p): Query<TradesPagination>,
) -> Result<Json<Value>, ApiError> {
    let limit  = p.limit.unwrap_or(50).min(200);
    let trades = queries::get_vault_trades(&ctx.db, &profile, limit, p.before).await?;
    let list: Vec<Value> = trades.iter().map(|tr| json!({
        "market":         tr.market,
        "direction":      tr.direction,
        "size_usd":       tr.size_usd.to_string(),
        "leverage_x":     tr.leverage_x,
        "entry_px":       tr.entry_px.to_string(),
        "exit_px":        tr.exit_px.to_string(),
        "realized_pnl":   tr.realized_pnl.to_string(),
        "fees_usd":       tr.fees_usd.to_string(),
        "was_liquidated": tr.was_liquidated,
        "opened_at":      tr.opened_at,
        "closed_at":      tr.closed_at,
    })).collect();
    Ok(Json(json!(list)))
}

// ── GET /v1/investors/:wallet/account  (protected) ────────────────────────────

pub async fn get_investor_account(
    State(ctx): State<AppState>,
    Path(wallet): Path<String>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let authed = extract_wallet(&headers, &ctx.jwt_secret)?;
    if authed != wallet {
        return Err(ApiError::Forbidden);
    }

    let acct = queries::get_investor_account(&ctx.db, &wallet)
        .await?
        .ok_or(ApiError::NotFound)?;

    let positions = queries::get_investor_positions(&ctx.db, &wallet).await?;

    let mut position_list: Vec<Value> = Vec::new();
    for pos in &positions {
        let handle = queries::get_trader_by_profile(&ctx.db, &pos.profile)
            .await?
            .map(|t| t.handle)
            .unwrap_or_else(|| pos.profile.clone());

        position_list.push(json!({
            "profile":                 pos.profile,
            "trader_handle":           handle,
            "shares":                  pos.shares.to_string(),
            "cost_basis_usd":          pos.cost_basis_usd.to_string(),
            "pending_withdraw_shares": pos.pending_withdraw_shares.to_string(),
            "withdraw_ready_ts":       pos.withdraw_ready_ts,
        }));
    }

    Ok(Json(json!({
        "owner":               acct.owner,
        "position_count":      acct.position_count,
        "total_deposited_usd": acct.total_deposited_usd.to_string(),
        "positions":           position_list,
    })))
}

// ── GET /v1/investors/:wallet/portfolio  (protected) ──────────────────────────

pub async fn get_investor_portfolio(
    State(ctx): State<AppState>,
    Path(wallet): Path<String>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let authed = extract_wallet(&headers, &ctx.jwt_secret)?;
    if authed != wallet {
        return Err(ApiError::Forbidden);
    }

    let positions = queries::get_investor_positions(&ctx.db, &wallet).await?;

    let mut out: Vec<Value> = Vec::new();
    for pos in &positions {
        if let Some(vault) = queries::get_trader_by_profile(&ctx.db, &pos.profile).await? {
            let value_usd = pos.shares * vault.nav_per_share;
            let pnl_usd   = value_usd - pos.cost_basis_usd;
            out.push(json!({
                "profile":        pos.profile,
                "trader_handle":  vault.handle,
                "shares":         pos.shares.to_string(),
                "value_usd":      value_usd.to_string(),
                "cost_basis_usd": pos.cost_basis_usd.to_string(),
                "pnl_usd":        pnl_usd.to_string(),
            }));
        }
    }

    Ok(Json(json!(out)))
}

// ── GET /v1/leaderboard ───────────────────────────────────────────────────────

pub async fn leaderboard(State(ctx): State<AppState>) -> Result<Json<Value>, ApiError> {
    let by_score  = queries::leaderboard_by_score(&ctx.db, 100).await?;
    let by_return = queries::leaderboard_by_return(&ctx.db, 100).await?;

    let score_list: Vec<Value> = by_score.iter().enumerate().map(|(i, (handle, score, tier))| json!({
        "rank":   i + 1,
        "handle": handle,
        "score":  score,
        "tier":   tier,
    })).collect();

    let return_list: Vec<Value> = by_return.iter().enumerate().map(|(i, (handle, ret))| json!({
        "rank":      i + 1,
        "handle":    handle,
        "return_30d": ret,
    })).collect();

    Ok(Json(json!({
        "by_score":  score_list,
        "by_return": return_list,
    })))
}

// ── GET /v1/prices ────────────────────────────────────────────────────────────

pub async fn prices(State(ctx): State<AppState>) -> Result<Json<Value>, ApiError> {
    let mut conn = ctx.redis
        .get_multiplexed_tokio_connection()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    match arcadia_prices::get_cached_prices(&mut conn).await {
        Ok(Some(map)) => Ok(Json(json!(map))),
        _             => Ok(Json(json!({}))),
    }
}

// ── GET /v1/score?wallet=<b58>  (x-api-key) ──────────────────────────────────

#[derive(Deserialize)]
pub struct ScoreQuery {
    wallet: String,
}

pub async fn get_score(
    State(ctx): State<AppState>,
    Query(q): Query<ScoreQuery>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let api_key = headers.get("x-api-key")
        .and_then(|v| v.to_str().ok())
        .ok_or(ApiError::Unauthorized)?;

    let key_hash = sha256_hex(api_key);
    let traders  = queries::list_traders(&ctx.db).await?;
    let trader   = traders.into_iter()
        .find(|t| t.trader == q.wallet && t.api_key_hash.as_deref() == Some(&key_hash))
        .ok_or(ApiError::Unauthorized)?;

    let snap = queries::latest_score(&ctx.db, &trader.profile)
        .await?
        .ok_or(ApiError::NotFound)?;

    Ok(Json(json!({
        "wallet":       q.wallet,
        "score":        snap.score,
        "tier":         snap.tier,
        "confidence":   snap.confidence,
        "ci":           [snap.ci_low, snap.ci_high],
        "capacity_usd": snap.capacity_usd.to_string(),
        "computed_at":  snap.computed_at,
    })))
}

// ── GET /v1/traders/:handle/score-history ─────────────────────────────────────

#[derive(Deserialize)]
pub struct ScoreHistoryQuery {
    limit: Option<i64>,
}

pub async fn trader_score_history(
    State(ctx): State<AppState>,
    Path(handle): Path<String>,
    Query(q): Query<ScoreHistoryQuery>,
) -> Result<Json<Value>, ApiError> {
    let t = queries::get_trader_by_handle(&ctx.db, &handle)
        .await?
        .ok_or(ApiError::NotFound)?;

    let limit = q.limit.unwrap_or(180).clamp(1, 730);
    let snaps = queries::score_history(&ctx.db, &t.profile, limit).await?;

    let list: Vec<Value> = snaps.iter().rev().map(|s| json!({
        "computed_at": s.computed_at,
        "score":       s.score,
        "tier":        s.tier,
        "confidence":  s.confidence,
        "ci":          [s.ci_low, s.ci_high],
        "max_dd":      s.max_dd,
        "sortino":     s.sortino,
        "calmar":      s.calmar,
        "trade_count": s.trade_count,
        "days_active": s.days_active,
    })).collect();

    Ok(Json(json!(list)))
}

// ── GET /v1/traders/:handle/pnl-history ───────────────────────────────────────

#[derive(Deserialize)]
pub struct PnlHistoryQuery {
    days: Option<i64>,
}

/// Per-day realized PnL aggregated from closed trades in the vault.
pub async fn trader_pnl_history(
    State(ctx): State<AppState>,
    Path(handle): Path<String>,
    Query(q): Query<PnlHistoryQuery>,
) -> Result<Json<Value>, ApiError> {
    let t = queries::get_trader_by_handle(&ctx.db, &handle)
        .await?
        .ok_or(ApiError::NotFound)?;

    let days = q.days.unwrap_or(365).clamp(1, 3650);
    let since = Utc::now() - chrono::Duration::days(days as i64);

    let trades = queries::get_all_trades_for_profile(&ctx.db, &t.profile).await?;

    use std::collections::BTreeMap;
    let mut by_day: BTreeMap<chrono::NaiveDate, Decimal> = BTreeMap::new();
    for tr in &trades {
        if tr.closed_at < since { continue; }
        let day = tr.closed_at.date_naive();
        let entry = by_day.entry(day).or_insert(Decimal::ZERO);
        *entry += tr.realized_pnl;
    }

    let list: Vec<Value> = by_day.iter().map(|(day, pnl)| json!({
        "day":     day,
        "pnl_usd": pnl,
    })).collect();

    Ok(Json(json!(list)))
}

// ── GET /v1/vaults/:profile/nav-history ────────────────────────────────────────

#[derive(Deserialize)]
pub struct NavHistoryQuery {
    days: Option<i64>,
}

pub async fn vault_nav_history(
    State(ctx): State<AppState>,
    Path(profile): Path<String>,
    Query(q): Query<NavHistoryQuery>,
) -> Result<Json<Value>, ApiError> {
    let days = q.days.unwrap_or(90).clamp(1, 3650);

    if queries::get_trader_by_profile(&ctx.db, &profile).await?.is_none() {
        return Err(ApiError::NotFound);
    }

    let curve = queries::get_nav_history(&ctx.db, &profile, days).await?;

    let list: Vec<Value> = curve.iter().map(|ep| json!({
        "day":     ep.day,
        "nav":     ep.twr_nav,
        "aum_usd": ep.aum_usd,
    })).collect();

    Ok(Json(json!(list)))
}

// ── GET /v1/investors/:wallet/flows (protected) ────────────────────────────────

#[derive(Deserialize)]
pub struct FlowsQuery {
    limit: Option<i64>,
}

pub async fn get_investor_flows(
    State(ctx): State<AppState>,
    Path(wallet): Path<String>,
    headers: HeaderMap,
    Query(q): Query<FlowsQuery>,
) -> Result<Json<Value>, ApiError> {
    let authed = extract_wallet(&headers, &ctx.jwt_secret)?;
    if authed != wallet {
        return Err(ApiError::Forbidden);
    }

    let limit = q.limit.unwrap_or(200).clamp(1, 1000);
    let flows = queries::get_flows_for_owner(&ctx.db, &wallet, limit).await?;

    let mut handles: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();
    for f in &flows {
        if handles.contains_key(&f.profile) { continue; }
        if let Some(t) = queries::get_trader_by_profile(&ctx.db, &f.profile).await? {
            handles.insert(f.profile.clone(), t.handle);
        }
    }

    let list: Vec<Value> = flows.iter().map(|f| {
        let handle = handles.get(&f.profile).cloned().unwrap_or_else(|| f.profile.clone());
        json!({
            "signature":      f.signature,
            "profile":         f.profile,
            "trader_handle":  handle,
            "is_trader":      f.is_trader,
            "kind":           f.kind,
            "amount_usd":     f.amount_usd.to_string(),
            "shares":         f.shares.to_string(),
            "nav_per_share":  f.nav_per_share.to_string(),
            "ts":             f.ts,
        })
    }).collect();

    Ok(Json(json!(list)))
}

// ── GET /v1/investors/:wallet/notifications (protected) ───────────────────────

#[derive(Deserialize)]
pub struct NotificationsQuery {
    limit: Option<i64>,
}

/// Derived notification feed: most-recent investor flows + vault trade
/// settlements for vaults the investor holds (or held) a position in.
pub async fn get_investor_notifications(
    State(ctx): State<AppState>,
    Path(wallet): Path<String>,
    headers: HeaderMap,
    Query(q): Query<NotificationsQuery>,
) -> Result<Json<Value>, ApiError> {
    let authed = extract_wallet(&headers, &ctx.jwt_secret)?;
    if authed != wallet {
        return Err(ApiError::Forbidden);
    }

    let limit = q.limit.unwrap_or(25).clamp(1, 200);

    // Investor's own flows (deposits, withdrawals, settlements).
    let flows = queries::get_flows_for_owner(&ctx.db, &wallet, limit * 2).await?;

    // Positions held (current) so we can surface vault trades for those vaults.
    let positions = queries::get_investor_positions(&ctx.db, &wallet).await?;

    let held_profiles: std::collections::HashSet<String> =
        positions.iter().map(|p| p.profile.clone()).collect();

    let mut notifications: Vec<(DateTime<Utc>, Value)> = Vec::new();

    // Pre-fetch handle for each profile involved (dedupe).
    let mut handles: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();
    for f in &flows {
        if handles.contains_key(&f.profile) { continue; }
        if let Some(t) = queries::get_trader_by_profile(&ctx.db, &f.profile).await? {
            handles.insert(f.profile.clone(), t.handle);
        }
    }
    for p in &held_profiles {
        if handles.contains_key(p) { continue; }
        if let Some(t) = queries::get_trader_by_profile(&ctx.db, p).await? {
            handles.insert(p.clone(), t.handle);
        }
    }

    for f in &flows {
        let kind_label = match f.kind.as_str() {
            "deposit"  => "Deposit confirmed",
            "withdraw" => "Withdrawal requested",
            "settle"   | "settlement" => "Performance fee settled",
            other      => other,
        };
        let handle = handles.get(&f.profile).cloned().unwrap_or_default();
        let title = if handle.is_empty() {
            kind_label.to_string()
        } else {
            format!("{} @{}", kind_label, handle)
        };
        let amount = f.amount_usd.abs();
        let sign = if f.kind == "withdraw" { "-" } else { "+" };
        notifications.push((
            f.ts,
            json!({
                "kind":   f.kind,
                "title":  title,
                "detail": format!("{}${} USDC", sign, amount),
                "ts":     f.ts,
            }),
        ));
    }

    // Vault trade settlements for held positions (per-profile, last N).
    for profile in &held_profiles {
        let handle = handles.get(profile).cloned().unwrap_or_default();
        let trades =
            queries::get_vault_trades(&ctx.db, profile, limit, None).await?;
        for tr in &trades {
            let dir = if tr.direction == 0 { "long" } else { "short" };
            let pnl = tr.realized_pnl;
            let verb = if pnl.is_zero() { "closed" }
                       else if pnl.is_sign_negative() { "loss" }
                       else { "win" };
            notifications.push((
                tr.closed_at,
                json!({
                    "kind":   "trade",
                    "title":  format!("@{} closed {} {} {}", handle, dir, tr.market, verb),
                    "detail": format!("{}${} USDC", if pnl.is_sign_negative() { "-" } else { "+" }, pnl.abs()),
                    "ts":     tr.closed_at,
                }),
            ));
        }
    }

    notifications.sort_by(|a, b| b.0.cmp(&a.0));
    notifications.truncate(limit as usize);

    let list: Vec<Value> = notifications.iter().map(|(_, v)| v.clone()).collect();
    Ok(Json(json!(list)))
}

// ── GET /v1/me  (protected) ────────────────────────────────────────────────────

pub async fn me(
    State(ctx): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let wallet = extract_wallet(&headers, &ctx.jwt_secret)?;

    // Check if this wallet belongs to a trader
    if let Some(trader) = queries::get_trader_by_wallet(&ctx.db, &wallet).await? {
        return Ok(Json(json!({
            "role":    "trader",
            "wallet":  wallet,
            "handle":  trader.handle,
            "profile": trader.profile,
        })));
    }

    // Default to investor
    Ok(Json(json!({
        "role":   "investor",
        "wallet": wallet,
    })))
}

// ── GET /v1/traders/:handle/classification ────────────────────────────────────

pub async fn get_trader_classification(
    State(ctx): State<AppState>,
    Path(handle): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let t = queries::get_trader_by_handle(&ctx.db, &handle)
        .await?
        .ok_or(ApiError::NotFound)?;

    let trades = queries::get_all_trades_for_profile(&ctx.db, &t.profile).await?;

    use arcadia_core::classify::{self, TradeSample};

    let samples: Vec<TradeSample> = trades
        .iter()
        .map(|tr| TradeSample {
            direction: tr.direction,
            size_usd: tr.size_usd,
            realized_pnl: tr.realized_pnl,
            fees_usd: tr.fees_usd,
            market: tr.market.clone(),
            closed_at_ts: tr.closed_at.timestamp(),
        })
        .collect();

    let features = classify::build_features(&samples);
    let result = classify::classify(&[features]);

    Ok(Json(serde_json::to_value(result).map_err(|e| {
        ApiError::Internal(anyhow::anyhow!(e))
    })?))
}

// ── GET /v1/traders/:handle/payouts ───────────────────────────────────────────

#[derive(Deserialize)]
pub struct PayoutsQuery {
    limit: Option<i64>,
}

pub async fn get_trader_payouts(
    State(ctx): State<AppState>,
    Path(handle): Path<String>,
    Query(q): Query<PayoutsQuery>,
) -> Result<Json<Value>, ApiError> {
    let t = queries::get_trader_by_handle(&ctx.db, &handle)
        .await?
        .ok_or(ApiError::NotFound)?;

    let limit = q.limit.unwrap_or(50).clamp(1, 500);
    let flows = queries::get_flows_for_profile_and_trader(&ctx.db, &t.profile, limit).await?;

    let list: Vec<Value> = flows.iter().map(|f| json!({
        "signature":  f.signature,
        "amount_usd": f.amount_usd.to_string(),
        "shares":     f.shares.to_string(),
        "ts":         f.ts,
    })).collect();

    Ok(Json(json!(list)))
}

// ── PATCH /v1/vaults/:profile/deposits (protected) ────────────────────────────

#[derive(Deserialize)]
pub struct DepositsBody {
    pub open: bool,
}

pub async fn patch_vault_deposits(
    State(ctx): State<AppState>,
    Path(profile): Path<String>,
    headers: HeaderMap,
    Json(body): Json<DepositsBody>,
) -> Result<Json<Value>, ApiError> {
    let wallet = extract_wallet(&headers, &ctx.jwt_secret)?;

    let trader = queries::get_trader_by_profile(&ctx.db, &profile)
        .await?
        .ok_or(ApiError::NotFound)?;

    if trader.trader != wallet {
        return Err(ApiError::Forbidden);
    }

    // Update deposits_open to the requested value
    queries::set_deposits_open(&ctx.db, &profile, body.open).await?;

    Ok(Json(json!({ "deposits_open": body.open })))
}

// ── Health ────────────────────────────────────────────────────────────────────

pub async fn health() -> StatusCode {
    StatusCode::OK
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn extract_wallet(headers: &HeaderMap, secret: &str) -> Result<String, ApiError> {
    let bearer = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(ApiError::Unauthorized)?;
    verify_jwt(bearer, secret)
}

fn sha256_hex(s: &str) -> String {
    use sha2::{Digest, Sha256};
    hex::encode(Sha256::digest(s.as_bytes()))
}
