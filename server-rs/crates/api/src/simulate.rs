/// POST /v1/trades/simulate
///
/// Records a closed simulated trade for a vault.
///
/// Auth:   Bearer JWT (wallet must be the vault's trader).
/// Body:   SimTradeReq  (JSON)
/// Return: SimTradeRes  (JSON) — the stored trade + oracle signature.
///
/// The oracle co-signs with the chain crate stub; when --features solana is
/// enabled the signature becomes a real devnet tx.
use crate::{auth::verify_jwt, error::ApiError, state::AppState};
use arcadia_chain::{submit_record_trade, OracleConfig, SimTradeRequest};
use arcadia_db::{models::DbTrade, queries};
use axum::{extract::State, http::HeaderMap, Json};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

// ── 10 bps on notional (size × leverage) ─────────────────────────────────────
const FEE_RATE: Decimal = dec!(0.001);

// ── Request ───────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct SimTradeReq {
    /// Vault profile address (base58).
    pub profile: String,
    /// Market symbol, e.g. "SOL/USD".
    pub market: String,
    /// 0 = long, 1 = short.
    pub direction: i16,
    /// Position size in USD (notional before leverage).
    pub size_usd: Decimal,
    /// Leverage multiplier, e.g. 5.00 for 5×.
    pub leverage: Decimal,
    /// Entry price in USD per base token.
    pub entry_px: Decimal,
    /// Exit price in USD per base token.
    /// If omitted, the latest cached price from Redis is used.
    pub exit_px: Option<Decimal>,
    /// When the trade opened. Defaults to now − 1 hour if omitted.
    pub opened_at: Option<DateTime<Utc>>,
    /// When the trade closed. Defaults to now if omitted.
    pub closed_at: Option<DateTime<Utc>>,
}

// ── Response ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct SimTradeRes {
    pub signature:      String,
    pub oracle_signed:  bool,
    pub market:         String,
    pub direction:      i16,
    pub size_usd:       String,
    pub leverage:       String,
    pub entry_px:       String,
    pub exit_px:        String,
    pub realized_pnl:   String,
    pub fees_usd:       String,
    pub was_liquidated: bool,
    pub opened_at:      DateTime<Utc>,
    pub closed_at:      DateTime<Utc>,
    /// Human-readable label for the frontend ("devnet simulation").
    pub label:          String,
}

// ── Handler ───────────────────────────────────────────────────────────────────

pub async fn handler(
    State(ctx): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<SimTradeReq>,
) -> Result<Json<Value>, ApiError> {
    // ── 1. Auth ───────────────────────────────────────────────────────────────
    let wallet = extract_wallet(&headers, &ctx.jwt_secret)?;

    // ── 2. Verify the caller owns the vault ───────────────────────────────────
    let profile = queries::get_trader_by_profile(&ctx.db, &body.profile)
        .await?
        .ok_or(ApiError::NotFound)?;

    if profile.trader != wallet {
        return Err(ApiError::Forbidden);
    }

    // ── 3. Resolve exit price ─────────────────────────────────────────────────
    let exit_px = match body.exit_px {
        Some(px) => px,
        None => resolve_live_price(&ctx, &body.market).await?,
    };

    // Validate prices are positive and non-zero
    if body.entry_px <= Decimal::ZERO || exit_px <= Decimal::ZERO {
        return Err(ApiError::BadRequest("prices must be positive".into()));
    }
    if body.size_usd <= Decimal::ZERO {
        return Err(ApiError::BadRequest("size_usd must be positive".into()));
    }
    if body.leverage < Decimal::ONE {
        return Err(ApiError::BadRequest("leverage must be ≥ 1".into()));
    }

    // ── 4. Compute PnL and fees ───────────────────────────────────────────────
    let (realized_pnl, fees_usd, was_liquidated) =
        compute_pnl(body.direction, body.size_usd, body.leverage, body.entry_px, exit_px);

    // ── 5. Timestamps ─────────────────────────────────────────────────────────
    let now        = Utc::now();
    let closed_at  = body.closed_at.unwrap_or(now);
    let opened_at  = body.opened_at
        .unwrap_or_else(|| closed_at - chrono::Duration::hours(1));

    if opened_at >= closed_at {
        return Err(ApiError::BadRequest("opened_at must be before closed_at".into()));
    }

    // ── 6. Oracle co-sign (stub or live depending on build features) ──────────
    let oracle_cfg = OracleConfig::from_env()?;
    let chain_req  = SimTradeRequest {
        profile:       body.profile.clone(),
        market:        body.market.clone(),
        direction:     body.direction as u8,
        size_usd:      body.size_usd.try_into().unwrap_or(0),
        leverage_x100: (body.leverage * dec!(100)).try_into().unwrap_or(100),
        entry_px:      micro_units(body.entry_px),
        exit_px:       micro_units(exit_px),
    };
    let oracle_result = submit_record_trade(&oracle_cfg, &chain_req).await?;

    // ── 7. Build deterministic signature for the DB row ───────────────────────
    // For stub builds the chain signature is "STUB_*"; use our own hash so the
    // DB row is always unique and human-readable.
    let sig = sim_signature(&body.profile, &body.market, closed_at, &oracle_result.signature);

    // ── 8. Persist the trade ──────────────────────────────────────────────────
    let row = DbTrade {
        signature:      sig.clone(),
        event_index:    0,
        slot:           0,
        profile:        body.profile.clone(),
        trader:         wallet.clone(),
        market:         body.market.clone(),
        direction:      body.direction,
        size_usd:       body.size_usd,
        leverage_x:     body.leverage,
        entry_px:       body.entry_px,
        exit_px,
        realized_pnl,
        fees_usd,
        was_liquidated,
        opened_at,
        closed_at,
    };
    queries::insert_trade(&ctx.db, &row).await?;

    // ── 9. Return ─────────────────────────────────────────────────────────────
    Ok(Json(json!(SimTradeRes {
        signature:      sig,
        oracle_signed:  oracle_result.confirmed,
        market:         body.market,
        direction:      body.direction,
        size_usd:       body.size_usd.to_string(),
        leverage:       body.leverage.to_string(),
        entry_px:       body.entry_px.to_string(),
        exit_px:        exit_px.to_string(),
        realized_pnl:   realized_pnl.to_string(),
        fees_usd:       fees_usd.to_string(),
        was_liquidated,
        opened_at,
        closed_at,
        label:          "devnet simulation".into(),
    })))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Compute realized PnL, fees, and liquidation flag.
///
/// Returns `(realized_pnl, fees_usd, was_liquidated)`.
///
/// PnL formula:
///   long:  pnl = (exit - entry) / entry × size
///   short: pnl = (entry - exit) / entry × size
///
/// Fees: size × leverage × FEE_RATE (10 bps on notional)
/// Liquidated if loss > 80% of size (margin call threshold at 20%).
fn compute_pnl(
    direction: i16,
    size_usd: Decimal,
    leverage: Decimal,
    entry_px: Decimal,
    exit_px: Decimal,
) -> (Decimal, Decimal, bool) {
    let fees_usd = (size_usd * leverage * FEE_RATE)
        .round_dp(6);

    let raw_pnl = match direction {
        0 => (exit_px - entry_px) / entry_px * size_usd,   // long
        1 => (entry_px - exit_px) / entry_px * size_usd,   // short
        _ => Decimal::ZERO,
    };

    let realized_pnl = (raw_pnl - fees_usd).round_dp(6);

    // Margin call: if loss exceeds 80% of collateral (size_usd), mark liquidated
    let was_liquidated = realized_pnl < -(size_usd * dec!(0.8));

    (realized_pnl, fees_usd, was_liquidated)
}

/// Try to get the current price of `market` from the Redis price cache.
/// Falls back to returning an error if no price is available.
async fn resolve_live_price(ctx: &AppState, market: &str) -> Result<Decimal, ApiError> {
    let mut conn = ctx
        .redis
        .get_multiplexed_tokio_connection()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    let prices = arcadia_prices::get_cached_prices(&mut conn)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    // Normalise "SOL/USD" → "SOL" for price map lookup.
    let symbol = market.split('/').next().unwrap_or(market).to_uppercase();

    prices
        .and_then(|map| {
            map.get(&symbol)
                .or_else(|| map.get(market))
                .map(|mp| mp.price)
        })
        .ok_or_else(|| {
            ApiError::BadRequest(format!(
                "no live price for {market}; provide exit_px explicitly or wait for price worker"
            ))
        })
}

/// Convert a Decimal USD price to micro-units (×10^6) for the chain crate.
fn micro_units(px: Decimal) -> u64 {
    let scaled = px * dec!(1_000_000);
    scaled.try_into().unwrap_or(u64::MAX)
}

/// Deterministic, human-readable signature for a sim trade DB row.
/// Format: "sim:<hex8>:<market_slug>:<unix>".
fn sim_signature(profile: &str, market: &str, closed_at: DateTime<Utc>, oracle_sig: &str) -> String {
    let mut h = Sha256::new();
    h.update(profile.as_bytes());
    h.update(market.as_bytes());
    h.update(closed_at.timestamp().to_le_bytes());
    h.update(oracle_sig.as_bytes());
    let hash = h.finalize();
    let hex8 = hex::encode(&hash[..4]);
    let slug  = market.replace('/', "-").to_lowercase();
    format!("sim:{hex8}:{slug}:{}", closed_at.timestamp())
}

fn extract_wallet(headers: &HeaderMap, secret: &str) -> Result<String, ApiError> {
    let bearer = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(ApiError::Unauthorized)?;
    verify_jwt(bearer, secret)
}
