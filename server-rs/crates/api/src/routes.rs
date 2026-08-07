/// All /v1 route handlers.
use crate::{
    auth::verify_jwt,
    error::ApiError,
    state::AppState,
};
use arcadia_db::models::DbTraderProfile;
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
    use arcadia_core::classify::{self, TradeSample};
    let traders = queries::list_traders_paginated(&ctx.db, 100).await?;

    let mut list: Vec<Value> = Vec::with_capacity(traders.len());
    for t in &traders {
        let snap = queries::latest_score(&ctx.db, &t.profile).await.unwrap_or(None);

        let (agent, style) = if let Ok(trades) = queries::get_all_trades_for_profile(&ctx.db, &t.profile).await {
            if trades.is_empty() {
                ("human".to_string(), "No activity".to_string())
            } else {
                let samples: Vec<TradeSample> = trades.iter().map(|tr| TradeSample {
                    direction: tr.direction,
                    size_usd: tr.size_usd,
                    realized_pnl: tr.realized_pnl,
                    fees_usd: tr.fees_usd,
                    market: tr.market.clone(),
                    closed_at_ts: tr.closed_at.timestamp(),
                }).collect();
                let features = classify::build_features(&samples);
                let result = classify::classify(&[features]);
                (result.bot.verdict, result.profile.label)
            }
        } else {
            ("human".to_string(), "No activity".to_string())
        };

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
            "agent":         agent,
            "style":         style,
        }));
    }
    Ok(Json(json!(list)))
}

// ── GET /v1/traders/:handle ───────────────────────────────────────────────────

pub async fn get_trader(
    State(ctx): State<AppState>,
    Path(handle): Path<String>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let t = queries::get_trader_by_handle(&ctx.db, &handle)
        .await?
        .ok_or(ApiError::NotFound)?;

    let snap   = queries::latest_score(&ctx.db, &t.profile).await?;
    let curve  = queries::get_equity_curve(&ctx.db, &t.profile).await?;

    // Privacy: per-trade strategy data is only served to the profile's own
    // trader. Everyone else (anonymous or investors) gets aggregates only.
    let is_owner = maybe_wallet(&headers, &ctx.jwt_secret).as_deref() == Some(&t.trader);

    let equity_curve: Vec<Value> = curve.iter().map(|ep| json!({
        "day": ep.day.to_string(),
        "nav": ep.twr_nav,
    })).collect();

    let trade_list: Vec<Value> = if is_owner {
        let trades = queries::get_vault_trades(&ctx.db, &t.profile, 50, None).await?;
        trades.iter().map(|tr| json!({
            "market":         tr.market,
            "direction":      tr.direction,
            "size_usd":       tr.size_usd.to_string(),
            "leverage_x":     tr.leverage_x,
            "realized_pnl":   tr.realized_pnl.to_string(),
            "fees_usd":       tr.fees_usd.to_string(),
            "was_liquidated": tr.was_liquidated,
            "opened_at":      tr.opened_at,
            "closed_at":      tr.closed_at,
        })).collect()
    } else {
        Vec::new()
    };

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
        },
        "is_owner":           is_owner,
        "equity_curve":       equity_curve,
        "trades":             trade_list,
        "capacity": {
            "total_usd": t.capacity_cap_usd.to_string(),
            "used_usd":  t.aum_usd.to_string(),
        },
        "aum_usd":            t.aum_usd.to_string(),
        "investors_count":    t.investors_count,
        "days_active":        curve.len() as i32,
        "trade_count":        queries::count_vault_trades(&ctx.db, &t.profile).await? as i32,
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
    headers: HeaderMap,
    Query(p): Query<TradesPagination>,
) -> Result<Json<Value>, ApiError> {
    let trader = queries::get_trader_by_profile(&ctx.db, &profile)
        .await?
        .ok_or(ApiError::NotFound)?;

    // Per-trade strategy data is trader-only.
    if maybe_wallet(&headers, &ctx.jwt_secret).as_deref() != Some(&trader.trader) {
        return Ok(Json(json!([])));
    }

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
    let profile_refs: Vec<&str> = positions.iter().map(|p| p.profile.as_str()).collect();
    let trader_profiles = queries::get_trader_profiles_batch(&ctx.db, &profile_refs).await?;
    let handle_map: std::collections::HashMap<&str, &str> = trader_profiles
        .iter()
        .map(|t| (t.profile.as_str(), t.handle.as_str()))
        .collect();

    for pos in &positions {
        let handle = handle_map.get(pos.profile.as_str()).copied().unwrap_or(&pos.profile);

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
    let profile_refs: Vec<&str> = positions.iter().map(|p| p.profile.as_str()).collect();
    let trader_profiles = queries::get_trader_profiles_batch(&ctx.db, &profile_refs).await?;
    let vault_map: std::collections::HashMap<&str, &DbTraderProfile> = trader_profiles
        .iter()
        .map(|t| (t.profile.as_str(), t))
        .collect();

    for pos in &positions {
        if let Some(vault) = vault_map.get(pos.profile.as_str()) {
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
    let trader = queries::get_trader_by_wallet(&ctx.db, &q.wallet)
        .await?
        .filter(|t| t.api_key_hash.as_deref() == Some(&key_hash))
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

    let trades = queries::get_trades_since(&ctx.db, &t.profile, since).await?;

    use std::collections::BTreeMap;
    let mut by_day: BTreeMap<chrono::NaiveDate, Decimal> = BTreeMap::new();
    for tr in &trades {
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

    let distinct_profiles: std::collections::BTreeSet<&str> =
        flows.iter().map(|f| f.profile.as_str()).collect();
    let profile_refs: Vec<&str> = distinct_profiles.into_iter().collect();
    let trader_profiles = queries::get_trader_profiles_batch(&ctx.db, &profile_refs).await?;
    let handles: std::collections::HashMap<String, String> = trader_profiles
        .iter()
        .map(|t| (t.profile.clone(), t.handle.clone()))
        .collect();

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

    // Pre-fetch handle for each profile involved (dedupe via batch).
    let all_profiles: std::collections::BTreeSet<String> = flows.iter()
        .map(|f| f.profile.clone())
        .chain(held_profiles.iter().cloned())
        .collect();
    let profile_refs: Vec<&str> = all_profiles.iter().map(|s| s.as_str()).collect();
    let trader_profiles = queries::get_trader_profiles_batch(&ctx.db, &profile_refs).await?;
    let handles: std::collections::HashMap<String, String> = trader_profiles
        .iter()
        .map(|t| (t.profile.clone(), t.handle.clone()))
        .collect();

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
    // Privacy: no per-trade strategy detail (market/direction) is surfaced —
    // investors see only that a position was closed and the net PnL.
    for profile in &held_profiles {
        let handle = handles.get(profile).cloned().unwrap_or_default();
        let trades =
            queries::get_vault_trades(&ctx.db, profile, limit, None).await?;
        for tr in &trades {
            let pnl = tr.realized_pnl;
            notifications.push((
                tr.closed_at,
                json!({
                    "kind":   "trade",
                    "title":  format!("@{} closed a position", handle),
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
            "role":          "trader",
            "wallet":        wallet,
            "handle":        trader.handle,
            "profile":       trader.profile,
            "execution_only": ctx.execution_only,
        })));
    }

    // Default to investor
    Ok(Json(json!({
        "role":           "investor",
        "wallet":         wallet,
        "execution_only": ctx.execution_only,
    })))
}

// ── GET /v1/traders/:handle/classification ────────────────────────────────────

pub async fn get_trader_classification(
    State(ctx): State<AppState>,
    Path(handle): Path<String>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let t = queries::get_trader_by_handle(&ctx.db, &handle)
        .await?
        .ok_or(ApiError::NotFound)?;

    // Classifier evidence leaks behavioral strategy signals — trader-only.
    if maybe_wallet(&headers, &ctx.jwt_secret).as_deref() != Some(&t.trader) {
        return Err(ApiError::NotFound);
    }

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
    headers: HeaderMap,
    Query(q): Query<PayoutsQuery>,
) -> Result<Json<Value>, ApiError> {
    let t = queries::get_trader_by_handle(&ctx.db, &handle)
        .await?
        .ok_or(ApiError::NotFound)?;

    // Payout timing/magnitude is trader-only.
    if maybe_wallet(&headers, &ctx.jwt_secret).as_deref() != Some(&t.trader) {
        return Err(ApiError::NotFound);
    }

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

// ── Waitlist ──────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct WaitlistSignupBody {
    email:      String,
    #[serde(default)]
    name:       String,
    #[serde(default)]
    role:       String,
    #[serde(default)]
    experience: String,
    #[serde(default)]
    twitter:    String,
    #[serde(default)]
    discord:    String,
    #[serde(default)]
    wallet:     String,
    #[serde(default)]
    ref_code:   String,
    #[serde(default)]
    privy_token: Option<String>,
    #[serde(default)]
    utm_source:   String,
    #[serde(default)]
    utm_medium:   String,
    #[serde(default)]
    utm_campaign: String,
    #[serde(default)]
    utm_term:     String,
}

pub async fn post_waitlist(
    State(ctx): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<WaitlistSignupBody>,
) -> Result<Json<Value>, ApiError> {
    let email = body.email.trim().to_lowercase();
    if !email.contains('@') || !email.contains('.') {
        return Err(ApiError::BadRequest("Invalid email address".into()));
    }
    if queries::is_disposable_email(&email) {
        return Err(ApiError::BadRequest("Disposable email addresses are not allowed".into()));
    }

    let ip = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok())
        .or_else(|| headers.get("x-real-ip").and_then(|v| v.to_str().ok()))
        .unwrap_or("unknown");
    let ip_hash = sha256_hex(ip);

    let user_agent = headers.get("user-agent")
        .and_then(|v| v.to_str().ok()).unwrap_or("").to_string();

    let referred_by = if !body.ref_code.is_empty() {
        Some(body.ref_code.to_uppercase())
    } else { None };

    // Privy email proof (optional): a valid Privy access token whose verified
    // email matches the submitted address proves ownership. Privy sends and
    // verifies the OTP itself; we only check its /users/me result. Verified
    // signups count toward the referrer's referral_count.
    let mut email_verified = false;
    if let Some(token) = body.privy_token.as_deref().filter(|t| !t.is_empty()) {
        if let Ok(privy) = crate::auth::verify_privy_token(token).await {
            if privy.verified_email().map(str::to_lowercase).as_deref() == Some(email.as_str()) {
                email_verified = true;
            }
        }
    }

    let mut result = queries::insert_waitlist_user(
        &ctx.db, &email, &body.name, &body.role, &body.experience,
        &body.twitter, &body.discord, &body.wallet,
        referred_by.as_deref(), email_verified, "landing",
        &body.utm_source, &body.utm_medium, &body.utm_campaign, &body.utm_term,
        &ip_hash, &user_agent,
    ).await?;

    // Duplicate email, now proven via Privy → activate the existing row.
    if result.is_none() && email_verified {
        result = queries::verify_waitlist_email(&ctx.db, &email).await?;
    }

    let user = result.ok_or_else(|| ApiError::BadRequest("Email already registered".into()))?;

    // Credit the referrer once, and only for a verified signup.
    if email_verified {
        if let Some(code) = referred_by.as_deref() {
            queries::credit_referral(&ctx.db, code).await?;
        }
    }

    // Compute queue position
    let position = queries::get_waitlist_position(&ctx.db, user.id).await?;

    // Mint JWT for optional /me and /position lookups
    use jsonwebtoken::{encode, EncodingKey, Header};
    let claims = serde_json::json!({
        "sub": user.email, "uid": user.id,
        "exp": (Utc::now() + chrono::Duration::days(30)).timestamp(),
        "iat": Utc::now().timestamp(),
    });
    let jwt = encode(&Header::default(), &claims,
        &EncodingKey::from_secret(ctx.jwt_secret.as_bytes()))
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    tracing::info!("[waitlist] {email} joined — position {position} (ref: {})", user.referral_code);

    let (tier, fee_discount_pct, benefits) = referral_tier(user.referral_count);

    Ok(Json(json!({
        "ok": true,
        "message": "You're on the waitlist!",
        "email": email,
        "position": position,
        "referral_code": user.referral_code,
        "email_verified": user.email_verified,
        "referral_count": user.referral_count,
        "tier": tier,
        "fee_discount_pct": fee_discount_pct,
        "benefits": benefits,
        "jwt": jwt,
    })))
}

/// Verified-referral reward tiers. Queue influence is capped in
/// `get_waitlist_position`; fee discounts apply to live platform fees only.
fn referral_tier(count: i32) -> (String, i64, Vec<&'static str>) {
    if count >= 5 {
        (
            "Arcadian III".into(), 20,
            vec![
                "Wave-1 onboarding priority",
                "Early allocation slot",
                "20% platform-fee discount",
            ],
        )
    } else if count >= 3 {
        (
            "Arcadian II".into(), 10,
            vec!["Wave-1 onboarding priority", "10% platform-fee discount"],
        )
    } else if count >= 1 {
        ("Arcadian".into(), 0, vec!["Wave-1 onboarding priority"])
    } else {
        ("None".into(), 0, vec![])
    }
}

/// POST /v1/waitlist/verify — activate a joined waitlist row by proving the
/// email via Privy (Privy sends and verifies the OTP). Credits the referrer
/// exactly once (guarded by `verify_waitlist_email`).
#[derive(Deserialize)]
pub struct WaitlistVerifyBody {
    email:       String,
    privy_token: String,
}

pub async fn post_waitlist_verify(
    State(ctx): State<AppState>,
    Json(body): Json<WaitlistVerifyBody>,
) -> Result<Json<Value>, ApiError> {
    let email = body.email.trim().to_lowercase();
    let privy = crate::auth::verify_privy_token(&body.privy_token)
        .await
        .map_err(|_| ApiError::Unauthorized)?;
    if privy.verified_email().map(str::to_lowercase).as_deref() != Some(email.as_str()) {
        return Err(ApiError::BadRequest(
            "Privy email does not match the submitted address".into(),
        ));
    }

    let user = queries::verify_waitlist_email(&ctx.db, &email)
        .await?
        .ok_or_else(|| ApiError::BadRequest("Email not on the waitlist or already verified".into()))?;

    if let Some(code) = user.referred_by.as_deref() {
        queries::credit_referral(&ctx.db, code).await?;
    }

    let position = queries::get_waitlist_position(&ctx.db, user.id).await?;
    let (tier, fee_discount_pct, benefits) = referral_tier(user.referral_count);

    tracing::info!("[waitlist] {email} email verified via privy");
    Ok(Json(json!({
        "ok": true,
        "email": email,
        "email_verified": true,
        "position": position,
        "referral_count": user.referral_count,
        "tier": tier,
        "fee_discount_pct": fee_discount_pct,
        "benefits": benefits,
    })))
}

#[derive(Deserialize)]
pub struct TokenQuery { token: String }

pub async fn get_waitlist_position(
    State(ctx): State<AppState>,
    Query(q): Query<TokenQuery>,
) -> Result<Json<Value>, ApiError> {
    let uid = extract_waitlist_uid(&q.token, &ctx.jwt_secret)?;
    let pos = queries::get_waitlist_position(&ctx.db, uid).await?;
    Ok(Json(json!({ "position": pos })))
}

pub async fn get_waitlist_me(
    State(ctx): State<AppState>,
    Query(q): Query<TokenQuery>,
) -> Result<Json<Value>, ApiError> {
    let (uid, email) = extract_waitlist_jwt(&q.token, &ctx.jwt_secret)?;
    let user = queries::get_waitlist_user_by_email(&ctx.db, &email)
        .await?.ok_or(ApiError::NotFound)?;
    let position = queries::get_waitlist_position(&ctx.db, uid).await?;
    let (tier, fee_discount_pct, benefits) = referral_tier(user.referral_count);
    Ok(Json(json!({
        "id": user.id, "email": user.email,
        "email_verified": user.email_verified,
        "name": user.name, "role": user.role,
        "experience": user.experience,
        "twitter": user.twitter, "discord": user.discord, "wallet": user.wallet,
        "status": user.status,
        "referral_code": user.referral_code,
        "referral_count": user.referral_count,
        "tier": tier,
        "fee_discount_pct": fee_discount_pct,
        "benefits": benefits,
        "position": position,
        "created_at": user.created_at, "verified_at": user.verified_at,
    })))
}

fn extract_waitlist_uid(token: &str, secret: &str) -> Result<i64, ApiError> {
    use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
    let data = decode::<serde_json::Value>(token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::new(Algorithm::HS256))
        .map_err(|_| ApiError::Unauthorized)?;
    data.claims.get("uid").and_then(|v| v.as_i64()).ok_or(ApiError::Unauthorized)
}

fn extract_waitlist_jwt(token: &str, secret: &str) -> Result<(i64, String), ApiError> {
    use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
    let data = decode::<serde_json::Value>(token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::new(Algorithm::HS256))
        .map_err(|_| ApiError::Unauthorized)?;
    let uid = data.claims.get("uid").and_then(|v| v.as_i64()).ok_or(ApiError::Unauthorized)?;
    let sub = data.claims.get("sub").and_then(|v| v.as_str()).ok_or(ApiError::Unauthorized)?;
    Ok((uid, sub.to_string()))
}

// ── Admin ─────────────────────────────────────────────────────────────────────

pub async fn get_admin_waitlist(
    State(ctx): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let provided = headers.get("x-admin-key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !constant_time_eq(provided, &ctx.admin_key) || ctx.admin_key.is_empty() {
        tracing::warn!("[admin] rejected request from {ip}", ip = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok()).unwrap_or("unknown"));
        return Err(ApiError::Unauthorized);
    }

    let users = queries::list_waitlist_users(&ctx.db).await?;
    let mut list: Vec<Value> = Vec::with_capacity(users.len());
    for u in users {
        let position = queries::get_waitlist_position(&ctx.db, u.id).await?;
        list.push(json!({
            "id":              u.id,
            "email":           u.email,
            "email_verified":  u.email_verified,
            "name":            u.name,
            "role":            u.role,
            "experience":      u.experience,
            "twitter":         u.twitter,
            "discord":         u.discord,
            "wallet":          u.wallet,
            "status":          u.status,
            "referral_code":   u.referral_code,
            "referred_by":     u.referred_by,
            "source":          u.source,
            "utm_source":      u.utm_source,
            "utm_medium":      u.utm_medium,
            "utm_campaign":    u.utm_campaign,
            "utm_term":        u.utm_term,
            "position":        position,
            "created_at":      u.created_at,
            "verified_at":     u.verified_at,
        }));
    }
    tracing::info!("[admin] waitlist exported ({} rows)", list.len());
    Ok(Json(json!({ "users": list, "total": list.len() })))
}

/// Constant-time string comparison to resist timing attacks on admin key.
fn constant_time_eq(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.bytes().zip(b.bytes()).fold(0, |acc, (x, y)| acc | (x ^ y)) == 0
}

// ── POST /v1/traders/init ──────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct InitTraderReq {
    /// Optional display handle (auto-generated from wallet if omitted).
    pub handle: Option<String>,
}

/// POST /v1/traders/init — create a trader profile for the authenticated wallet.
///
/// In dev/simulation mode the wallet address doubles as the profile PDA.
pub async fn init_trader(
    State(ctx): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<InitTraderReq>,
) -> Result<Json<Value>, ApiError> {
    let wallet = extract_wallet(&headers, &ctx.jwt_secret)?;

    if let Some(_) = queries::get_trader_by_wallet(&ctx.db, &wallet).await? {
        return Err(ApiError::BadRequest("trader profile already exists".into()));
    }

    let profile = wallet.clone();
    let handle = body.handle.unwrap_or_else(|| format!("trader_{}", &wallet[..8]));
    let now = Utc::now();
    queries::upsert_trader_profile(&ctx.db, &profile, &wallet, &handle, now).await?;

    Ok(Json(json!({
        "profile": profile,
        "handle":  handle,
        "role":    "trader",
    })))
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

/// Extract the authenticated wallet if a valid bearer token is present, else
/// `None`. Used for optional-ownership checks on publicly reachable routes so a
/// logged-out visitor is treated as a guest, not an auth error.
fn maybe_wallet(headers: &HeaderMap, secret: &str) -> Option<String> {
    let bearer = headers
        .get("authorization")?
        .to_str()
        .ok()?
        .strip_prefix("Bearer ")?;
    verify_jwt(bearer, secret).ok()
}

fn sha256_hex(s: &str) -> String {
    use sha2::{Digest, Sha256};
    hex::encode(Sha256::digest(s.as_bytes()))
}
