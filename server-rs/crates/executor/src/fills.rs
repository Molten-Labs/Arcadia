/// Fill normalization + recording.
///
/// Trust boundary: the execution pipeline (sidecar + FlashTrade WS) is the only
/// writer of authoritative trades. This module is the thin layer that maps a
/// raw sidecar close + position snapshot into a canonical `DbFill`, then
/// persists it (together with its execution event) via `record_fill`.
///
/// Chain: Execution Venue → Sidecar → Normalize → record_fill → Score.
use anyhow::{Context, Result};
use arcadia_db::models::{DbExecutionEvent, DbFill};
use chrono::{DateTime, Utc};
use rust_decimal::prelude::*;
use rust_decimal::Decimal;

use crate::flash_ws::PositionMetrics;

/// A raw position snapshot returned by the execution-worker for a closed trade.
#[derive(Debug, Clone, serde::Deserialize)]
pub struct RawClose {
    /// Venue identifier, e.g. "flashtrade".
    pub venue: String,
    /// Base58 pubkey of the execution wallet that signed the trade.
    pub execution_wallet: String,
    /// Venue position/order identifier.
    pub position_id: String,
    /// Forwarding fill/settlement signature from the venue (or on-chain tx).
    pub fill_signature: String,
    /// App-level market symbol, e.g. "XAU/USD".
    pub market: String,
    /// 0 = long, 1 = short.
    pub direction: i16,
    /// Vault profile (PDA base58) this fill belongs to.
    pub profile: String,
    /// Trader wallet (base58) that owns the vault.
    pub trader: String,
    /// When the position opened.
    pub opened_at: DateTime<Utc>,
    /// When the position closed.
    pub closed_at: DateTime<Utc>,
    /// Canonical price data pulled from the venue snapshot.
    pub entry_px: Decimal,
    pub exit_px: Decimal,
    pub size_usd: Decimal,
    pub leverage_x: Decimal,
    pub realized_pnl: Decimal,
    pub fees_usd: Decimal,
    pub was_liquidated: bool,
    /// Transaction/slot for the DB cache row (0 for sidecar-originated).
    pub slot: i64,
}

impl RawClose {
    /// Build a RawClose by merging an execution event with live position
    /// metrics captured at close time.
    pub fn from_position(
        profile: &str,
        trader: &str,
        venue: &str,
        execution_wallet: &str,
        position_id: &str,
        fill_signature: &str,
        market: &str,
        direction: i16,
        opened_at: DateTime<Utc>,
        closed_at: DateTime<Utc>,
        slot: i64,
        pos: &PositionMetrics,
    ) -> Result<Self> {
        let entry_px = parse_num(&pos.entry_price_ui)
            .context("missing entry_price")?;
        // FlashTrade reports liquidation positions via a liquidation price; the
        // close snapshot's exit is not uniformly available, so fall back to the
        // reference price model: use entry as a baseline and derive PnL.
        let exit_px = parse_num(&pos.exit_price_ui).unwrap_or(entry_px);
        let size_usd = parse_num(&pos.size_usd_ui).context("missing size_usd")?;
        let leverage_x = parse_num(&pos.leverage_ui).unwrap_or(Decimal::ONE);
        let collateral = parse_num(&pos.collateral_amount_ui).unwrap_or(size_usd);
        let realized_pnl = parse_num(&pos.pnl_with_fee_usd_ui).unwrap_or_else(|_| {
            // Derive PnL from exit/entry when the venue omits it.
            (exit_px - entry_px) / entry_px * collateral * leverage_x
        });
        // fees_usd is included in pnl_with_fee; keep 0 here to avoid double count.
        let fees_usd = Decimal::ZERO;
        let was_liquidated = parse_num(&pos.liquidation_price_ui).is_ok();

        Ok(RawClose {
            venue: venue.to_string(),
            execution_wallet: execution_wallet.to_string(),
            position_id: position_id.to_string(),
            fill_signature: fill_signature.to_string(),
            market: market.to_string(),
            direction,
            profile: profile.to_string(),
            trader: trader.to_string(),
            opened_at,
            closed_at,
            entry_px,
            exit_px,
            size_usd,
            leverage_x,
            realized_pnl,
            fees_usd,
            was_liquidated,
            slot,
        })
    }

    /// Canonicalize into a DbFill for the scoring cache.
    pub fn to_fill(&self) -> DbFill {
        DbFill {
            signature:         self.fill_signature.clone(),
            event_index:       0,
            slot:              self.slot,
            profile:           self.profile.clone(),
            trader:            self.trader.clone(),
            market:            self.market.clone(),
            direction:         self.direction,
            size_usd:          self.size_usd,
            leverage_x:        self.leverage_x,
            entry_px:          self.entry_px,
            exit_px:           self.exit_px,
            realized_pnl:      self.realized_pnl,
            fees_usd:          self.fees_usd,
            was_liquidated:    self.was_liquidated,
            opened_at:         self.opened_at,
            closed_at:         self.closed_at,
            venue:             self.venue.clone(),
            execution_wallet:  self.execution_wallet.clone(),
            position_id:       self.position_id.clone(),
            fill_signature:    self.fill_signature.clone(),
            source:            "execution".into(),
        }
    }

    /// Append-only execution event for the ledger.
    pub fn to_event(&self) -> DbExecutionEvent {
        DbExecutionEvent {
            id:                0,
            profile:           self.profile.clone(),
            venue:             self.venue.clone(),
            execution_wallet:  self.execution_wallet.clone(),
            market:            self.market.clone(),
            position_id:       self.position_id.clone(),
            fill_signature:    self.fill_signature.clone(),
            event_type:        "close".into(),
            payload:           serde_json::json!({ "closed_at": self.closed_at.to_rfc3339() }),
            recorded_at:       Utc::now(),
        }
    }
}

/// Persist a normalized fill (trade + event) and return nothing on success.
pub async fn record(pool: &sqlx::PgPool, close: &RawClose) -> Result<()> {
    let fill = close.to_fill();
    let event = close.to_event();
    arcadia_db::queries::record_fill(pool, &fill).await?;
    arcadia_db::queries::insert_execution_event(pool, &event).await?;
    tracing::info!(
        profile = %close.profile,
        market = %close.market,
        pos = %close.position_id,
        pnl = %close.realized_pnl,
        "fill recorded from execution pipeline"
    );
    Ok(())
}

fn parse_num(s: &Option<String>) -> Result<Decimal> {
    let v = s.as_deref().context("value is None")?;
    let cleaned: String = v
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '.' || *c == '-' || *c == '+' || *c == ',')
        .collect();
    let cleaned = cleaned.replace(',', "");
    Decimal::from_str(&cleaned).with_context(|| format!("invalid decimal: {cleaned:?}"))
}