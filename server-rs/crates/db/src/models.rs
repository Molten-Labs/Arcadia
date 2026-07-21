use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// DB row mirrors trader_profile table.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DbTraderProfile {
    pub id: Uuid,
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

/// DB row mirrors investor_account table.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DbInvestorAccount {
    pub id: Uuid,
    pub owner: String,
    pub position_count: i32,
    pub total_deposited_usd: Decimal,
    pub initialized_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DB row mirrors investor_position table.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DbInvestorPosition {
    pub owner: String,
    pub profile: String,
    pub shares: Decimal,
    pub cost_basis_usd: Decimal,
    pub pending_withdraw_shares: Decimal,
    pub withdraw_ready_ts: Option<DateTime<Utc>>,
    pub updated_at: DateTime<Utc>,
}

/// DB row mirrors trade table.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DbTrade {
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

/// DB row mirrors flow table.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DbFlow {
    pub signature: String,
    pub event_index: i32,
    pub slot: i64,
    pub profile: String,
    pub owner: String,
    pub is_trader: bool,
    pub kind: String,
    pub amount_usd: Decimal,
    pub shares: Decimal,
    pub nav_per_share: Decimal,
    pub ts: DateTime<Utc>,
}

/// DB row mirrors equity_point table.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DbEquityPoint {
    pub profile: String,
    pub day: NaiveDate,
    pub twr_nav: Decimal,
    pub aum_usd: Decimal,
}

/// DB row mirrors score_snapshot table.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DbScoreSnapshot {
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

/// Slot-cursor row (tracks resume position for ingest worker).
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct DbIngestCursor {
    pub id: i32,
    pub last_slot: i64,
    pub updated_at: DateTime<Utc>,
}

/// Waitlist user.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct DbWaitlistUser {
    pub id:             i64,
    pub email:          String,
    pub email_verified: bool,
    pub name:           String,
    pub role:           String,
    pub experience:     String,
    pub twitter:        String,
    pub discord:        String,
    pub wallet:         String,
    pub status:         String,
    pub referral_code:  String,
    pub referred_by:    Option<String>,
    pub source:         String,
    pub utm_source:     String,
    pub utm_medium:     String,
    pub utm_campaign:   String,
    pub utm_term:       String,
    pub ip_hash:        String,
    pub user_agent:     String,
    pub created_at:     DateTime<Utc>,
    pub verified_at:    Option<DateTime<Utc>>,
    pub updated_at:     DateTime<Utc>,
}

/// Verification token.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct DbVerificationToken {
    pub id:         i64,
    pub email:      String,
    pub token:      String,
    pub expires_at: DateTime<Utc>,
    pub used:       bool,
    pub created_at: DateTime<Utc>,
}
