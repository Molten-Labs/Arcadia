use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

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
