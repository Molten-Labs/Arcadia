use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

// ── TraderProfile (mirrors the onchain PDA) ───────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraderProfile {
    pub profile: String,
    pub trader: String,
    pub handle: String,
    pub status: i16,
    pub score_tier: i16,
    pub total_shares: Decimal,
    pub trader_shares: Decimal,
    pub nav_per_share: Decimal,
    pub hwm_per_share: Decimal,
    pub capacity_cap_usd: Decimal,
    pub trader_claimable: Decimal,
    pub max_leverage: Decimal,
    pub aum_usd: Decimal,
    pub trader_self_funded: bool,
    pub deposits_open: bool,
    pub investors_count: i32,
    pub style_tags: Vec<String>,
    pub api_key_hash: Option<String>,
    pub initialized_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── InvestorAccount ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvestorAccount {
    pub owner: String,
    pub position_count: i32,
    pub total_deposited_usd: Decimal,
    pub initialized_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── InvestorPosition ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvestorPosition {
    pub owner: String,
    pub profile: String,
    pub shares: Decimal,
    pub cost_basis_usd: Decimal,
    pub pending_withdraw_shares: Decimal,
    pub withdraw_ready_ts: Option<DateTime<Utc>>,
    pub updated_at: DateTime<Utc>,
}

// ── Trade ──────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub signature: String,
    pub event_index: i32,
    pub slot: i64,
    pub profile: String,
    pub trader: String,
    pub market: String,
    pub direction: i16,
    pub size_usd: Decimal,
    pub leverage_x: Decimal,
    pub entry_px: Decimal,
    pub exit_px: Decimal,
    pub realized_pnl: Decimal,
    pub fees_usd: Decimal,
    pub was_liquidated: bool,
    pub opened_at: DateTime<Utc>,
    pub closed_at: DateTime<Utc>,
}

// ── Flow (deposit / withdrawal) ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Flow {
    pub signature: String,
    pub event_index: i32,
    pub slot: i64,
    pub profile: String,
    pub owner: String,
    pub is_trader: bool,
    pub kind: FlowKind,
    pub amount_usd: Decimal,
    pub shares: Decimal,
    pub nav_per_share: Decimal,
    pub ts: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FlowKind {
    Deposit,
    Withdraw,
}

impl std::fmt::Display for FlowKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FlowKind::Deposit  => write!(f, "deposit"),
            FlowKind::Withdraw => write!(f, "withdraw"),
        }
    }
}

impl std::str::FromStr for FlowKind {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "deposit"  => Ok(Self::Deposit),
            "withdraw" => Ok(Self::Withdraw),
            other      => Err(format!("unknown flow kind: {other}")),
        }
    }
}

// ── EquityPoint (daily TWR curve) ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EquityPoint {
    pub profile: String,
    pub day: chrono::NaiveDate,
    pub twr_nav: Decimal,
    pub aum_usd: Decimal,
}

// ── ScoreSnapshot ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoreSnapshot {
    pub profile: String,
    pub computed_at: DateTime<Utc>,
    pub score: i32,
    pub tier: Option<String>,
    pub confidence: Decimal,
    pub ci_low: Decimal,
    pub ci_high: Decimal,
    pub capacity_usd: Decimal,
    pub sortino: Decimal,
    pub calmar: Decimal,
    pub max_dd: Decimal,
    pub ulcer: Decimal,
    pub liq_rate: Decimal,
    pub pct_profitable: Decimal,
    pub avg_leverage: Decimal,
    pub trade_count: i32,
    pub days_active: i32,
}
