/// Arcadia scoring engine (pure, no IO).
///
/// Pipeline:
///   1. `twr::daily_returns`  — daily return series from equity_points
///   2. `metrics::compute`    — Sortino, Calmar, MaxDD, Ulcer, LiqRate, etc.
///   3. `score::compute`      — Arcadia Score (0-1000) + confidence + CI
///   4. `capacity::compute`   — dynamic capacity ceiling in USD
pub mod twr;
pub mod metrics;
pub mod score;
pub mod capacity;

pub use metrics::Metrics;
pub use score::ScoreResult;
pub use capacity::CapacityResult;

use arcadia_core::types::Trade;
use chrono::NaiveDate;
use rust_decimal::Decimal;

/// Full scoring run for one trader profile.
pub struct ScoringInput {
    /// Daily TWR equity curve (ascending by day).
    pub equity_curve: Vec<(NaiveDate, Decimal)>,
    /// All closed trades (full history).
    pub trades: Vec<Trade>,
}

pub struct ScoringOutput {
    pub metrics:  Metrics,
    pub score:    ScoreResult,
    pub capacity: CapacityResult,
}

pub fn run(input: &ScoringInput) -> ScoringOutput {
    let m = metrics::compute(&input.equity_curve, &input.trades);
    let n = input.trades.len() as u32;
    let s = score::compute(&m, n);
    let c = capacity::compute(s.score);
    ScoringOutput { metrics: m, score: s, capacity: c }
}
