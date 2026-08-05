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
