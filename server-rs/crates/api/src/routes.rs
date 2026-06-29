/// All /v1 route handlers.
use crate::{
    auth::{self, verify_jwt},
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
use serde::{Deserialize, Serialize};
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
