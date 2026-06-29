use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// All events emitted by the arcadia_vault Anchor program.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event_type")]
pub enum ArcadiaEvent {
    ProfileInitialized(ProfileInitialized),
    InvestorInitialized(InvestorInitialized),
    Deposited(Deposited),
    WithdrawRequested(WithdrawRequested),
    Withdrawn(Withdrawn),
    TradeClosed(TradeClosed),
    Settled(Settled),
    ProfitWithdrawn(ProfitWithdrawn),
}

// ── Event structs (decoded from borsh, onchain minor-unit values converted) ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileInitialized {
    pub profile: String,
    pub trader: String,
    pub ts: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvestorInitialized {
    pub investor: String,
    pub ts: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Deposited {
    pub profile: String,
    pub depositor: String,
    pub is_trader: bool,
    /// Decoded from u64 USDC minor units → Decimal dollars
    pub amount_usd: Decimal,
    /// Shares minted (raw value / 1e6 for display)
    pub shares_minted: Decimal,
    /// NAV per share (raw / 1e6)
    pub nav_per_share: Decimal,
    pub ts: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WithdrawRequested {
    pub profile: String,
    pub owner: String,
    pub shares: Decimal,
    pub withdraw_ready_ts: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Withdrawn {
    pub profile: String,
    pub owner: String,
    pub shares_burned: Decimal,
    pub amount_usd: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeClosed {
    pub profile: String,
    pub trader: String,
    pub market: String,
    /// 0 = long, 1 = short
    pub direction: u8,
    pub size_usd: Decimal,
    /// leverage_x100 / 100
    pub leverage_x: Decimal,
    pub entry_px: Decimal,
    pub exit_px: Decimal,
    /// signed, in USD
    pub realized_pnl: Decimal,
    pub fees_usd: Decimal,
    pub was_liquidated: bool,
    pub opened_at: DateTime<Utc>,
    pub closed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settled {
    pub profile: String,
    pub profit_usd: Decimal,
    pub trader_cut: Decimal,
    pub platform_cut: Decimal,
    pub hwm_per_share: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfitWithdrawn {
    pub profile: String,
    pub trader: String,
    pub amount_usd: Decimal,
}
