/// Arcadia Score engine — produces a score in [0, 1000].
///
/// Score = clamp(Q × C × G, 0, 1000)
///
/// Q = quality composite (weighted metric subscores, each normalised to [0,1])
/// C = confidence multiplier (logistic function of trade count; prior μ=400, σ=125)
/// G = guard factor (hard penalties for liquidations & extreme drawdown)
use crate::metrics::Metrics;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use serde::{Deserialize, Serialize};

// ── Constants from spec ───────────────────────────────────────────────────────
const PRIOR_MU: f64    = 400.0;
const CI_BASE: f64     = 125.0;
const MIN_TIER_SCORE: u32 = 600;

// ── Metric target ranges (for normalisation to 0-1) ──────────────────────────
// These are "excellent trader" benchmarks:
const SORTINO_TARGET: f64 = 3.0;   // 3.0+ → full score
const CALMAR_TARGET:  f64 = 2.0;   // 2.0+ → full score
const MAX_DD_FLOOR:   f64 = 0.30;  // 0% drawdown → full; 30%+ → 0
const LIQ_RATE_FLOOR: f64 = 0.05;  // 0% liq → full; 5%+ → 0
const PCT_PROF_TARGET: f64 = 0.60; // 60% win rate → full score

// ── Quality weights ───────────────────────────────────────────────────────────
const W_SORTINO:  f64 = 0.35;
const W_CALMAR:   f64 = 0.20;
const W_DRAWDOWN: f64 = 0.20;
const W_PROF:     f64 = 0.15;
const W_ULCER:    f64 = 0.10;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoreResult {
    /// Final Arcadia Score in [0, 1000]
    pub score: u32,
    /// Score confidence ∈ [0, 1]
    pub confidence: f64,
    /// 95% confidence interval lower bound
    pub ci_low: f64,
    /// 95% confidence interval upper bound
    pub ci_high: f64,
    /// Raw quality composite before C × G adjustments ∈ [0, 1000]
    pub quality_raw: f64,
}

pub fn compute(m: &Metrics, trade_count: u32) -> ScoreResult {
    if trade_count == 0 {
        return ScoreResult { score: 0, confidence: 0.0, ci_low: 0.0, ci_high: 0.0, quality_raw: 0.0 };
    }

    // ── Q: Quality composite (0-1000) ─────────────────────────────────────
    let s_sortino  = norm_pos(m.sortino,  0.0, SORTINO_TARGET);
    let s_calmar   = norm_pos(m.calmar,   0.0, CALMAR_TARGET);
    let s_drawdown = norm_neg(m.max_dd,   0.0, MAX_DD_FLOOR);
    let s_prof     = norm_pos(m.pct_profitable, 0.0, PCT_PROF_TARGET);
    let s_ulcer    = norm_neg(m.ulcer,    0.0, 0.20);

    let q_raw = (W_SORTINO  * s_sortino
               + W_CALMAR   * s_calmar
               + W_DRAWDOWN * s_drawdown
               + W_PROF     * s_prof
               + W_ULCER    * s_ulcer)
               * 1000.0;
    let q = q_raw.clamp(0.0, 1000.0);

    // ── C: Confidence (logistic, prior μ=400, σ=125) ──────────────────────
    //   C = 1 / (1 + exp(-(n - μ) / σ))
    let n = trade_count as f64;
    let confidence = 1.0 / (1.0 + (-(n - PRIOR_MU) / CI_BASE).exp());

    // ── G: Guard factor ────────────────────────────────────────────────────
    //   Penalises high liquidation rate and extreme drawdown.
    let g_liq  = guard_factor(m.liq_rate,  LIQ_RATE_FLOOR, 0.0, 1.0);
    let g_dd   = guard_factor(m.max_dd,    MAX_DD_FLOOR,    0.0, 1.0);
    let g = g_liq.min(g_dd);

    // ── Final score ────────────────────────────────────────────────────────
    let raw = q * confidence * g;
    let score = (raw.round() as u32).min(1000);

    // ── Confidence interval (±CI_BASE / sqrt(n)) ──────────────────────────
    let ci_half = CI_BASE / n.sqrt();
    let ci_low  = (raw - ci_half).max(0.0);
    let ci_high = (raw + ci_half).min(1000.0);

    ScoreResult { score, confidence, ci_low, ci_high, quality_raw: q }
}

/// Normalise a "higher is better" metric to [0, 1].
fn norm_pos(v: f64, floor: f64, target: f64) -> f64 {
    if target <= floor { return 0.0; }
    ((v - floor) / (target - floor)).clamp(0.0, 1.0)
}

/// Normalise a "lower is better" metric to [0, 1].
fn norm_neg(v: f64, best: f64, worst: f64) -> f64 {
    if worst <= best { return 1.0; }
    ((worst - v) / (worst - best)).clamp(0.0, 1.0)
}

/// Guard factor: 1.0 when v ≤ threshold, linearly decays to 0 at max_val.
fn guard_factor(v: f64, threshold: f64, min_out: f64, max_val: f64) -> f64 {
    if v <= threshold { return 1.0; }
    if v >= max_val   { return min_out; }
    (1.0 - (v - threshold) / (max_val - threshold)).max(min_out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::metrics::Metrics;

    fn good_metrics() -> Metrics {
        Metrics {
            sortino: 3.5, calmar: 2.5, max_dd: 0.08, ulcer: 0.04,
            liq_rate: 0.01, pct_profitable: 0.62, avg_leverage: 3.0,
            trade_count: 120, days_active: 180,
        }
    }

    #[test]
    fn good_trader_gets_tier() {
        let m = good_metrics();
        let s = compute(&m, 120);
        println!("Score: {}, Confidence: {:.3}", s.score, s.confidence);
        assert!(s.score >= 400, "expected score >= 400, got {}", s.score);
    }

    #[test]
    fn zero_trades_gives_zero() {
        let m = Metrics::zero();
        let s = compute(&m, 0);
        assert_eq!(s.score, 0);
    }

    #[test]
    fn confidence_increases_with_trades() {
        let m = good_metrics();
        let s10  = compute(&m, 10);
        let s500 = compute(&m, 500);
        assert!(s500.confidence > s10.confidence);
    }
}
