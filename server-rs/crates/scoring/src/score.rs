/// Arcadia Score engine — produces a score in [0, 1000].
///
/// Score = clamp(Q × C × G, 0, 1000)
///
/// Q = weighted sum of normalized metrics (each 0-100), ×10 → 0-1000
///   Normalization curves ported from Reputation Engine's MetricNormalizer.
/// C = confidence multiplier (logistic function of trade count; prior μ=400, σ=125)
/// G = guard factor (hard penalties for liquidations & extreme drawdown)
use crate::metrics::Metrics;
use serde::{Deserialize, Serialize};

// ── Weights (from Reputation Engine; must sum to 1.0) ─────────────────────────
const W_SHARPE:   f64 = 0.25;
const W_SORTINO:  f64 = 0.20;
const W_MAX_DD:   f64 = 0.15;
const W_CALMAR:   f64 = 0.15;
const W_VOLATILITY: f64 = 0.10;
const W_DOWNSIDE_DEV: f64 = 0.10;
const W_MEAN_RETURN: f64 = 0.05;

// ── Constants ─────────────────────────────────────────────────────────────────
const PRIOR_MU: f64 = 200.0;
const CI_BASE: f64  = 125.0;
const LIQ_RATE_FLOOR: f64 = 0.05;
const MAX_DD_FLOOR: f64   = 0.30;

// ── MetricNormalizer curves (ported from Reputation Engine) ──────────────────
// All return values in [0, 100]; higher is always better.

fn norm_sharpe(v: f64) -> f64 {
    if v <= 0.0 { return 0.0; }
    if v >= 3.0 { return 100.0; }
    v / 3.0 * 100.0
}

fn norm_sortino(v: f64) -> f64 {
    norm_sharpe(v)
}

fn norm_calmar(v: f64) -> f64 {
    if v <= 0.0 { return 0.0; }
    if v >= 5.0 { return 100.0; }
    v / 5.0 * 100.0
}

fn norm_volatility(v: f64) -> f64 {
    if v <= 0.0 { return 100.0; }
    (100.0 - v * 100.0).max(0.0)
}

fn norm_max_drawdown(v: f64) -> f64 {
    let dd = v.abs();
    if dd >= 1.0 { return 0.0; }
    (1.0 - dd) * 100.0
}

fn norm_mean_return(daily: f64) -> f64 {
    if daily <= 0.0 { return 0.0; }
    let ann = daily * 252.0 * 100.0;
    ann.min(100.0)
}

fn norm_downside_deviation(v: f64) -> f64 {
    if v <= 0.0 { return 100.0; }
    (100.0 - v * 100.0).max(0.0)
}

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

    // ── Normalize each metric → [0, 100] ─────────────────────────────────
    let n_sharpe   = norm_sharpe(m.sharpe);
    let n_sortino  = norm_sortino(m.sortino);
    let n_calmar   = norm_calmar(m.calmar);
    let n_max_dd   = norm_max_drawdown(m.max_dd);
    let n_vol      = norm_volatility(m.volatility);
    let n_ds_dev   = norm_downside_deviation(m.downside_deviation);
    let n_mean_ret = norm_mean_return(m.mean_return);

    // ── Q: Weighted composite (0-100) → scale to (0-1000) ────────────────
    let q_100 = W_SHARPE   * n_sharpe
               + W_SORTINO  * n_sortino
               + W_CALMAR   * n_calmar
               + W_MAX_DD   * n_max_dd
               + W_VOLATILITY   * n_vol
               + W_DOWNSIDE_DEV * n_ds_dev
               + W_MEAN_RETURN  * n_mean_ret;
    let q_raw = q_100 * 10.0;
    let q = q_raw.clamp(0.0, 1000.0);

    // ── C: Confidence (logistic, prior μ=400, σ=125) ──────────────────────
    let n = trade_count as f64;
    let confidence = 1.0 / (1.0 + (-(n - PRIOR_MU) / CI_BASE).exp());

    // ── G: Guard factor ────────────────────────────────────────────────────
    let g_liq = guard_factor(m.liq_rate, LIQ_RATE_FLOOR, 0.0, 1.0);
    let g_dd  = guard_factor(m.max_dd,   MAX_DD_FLOOR,   0.0, 1.0);
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
            sortino: 3.5, calmar: 2.5, sharpe: 2.0,
            max_dd: 0.08, ulcer: 0.04, volatility: 0.25,
            mean_return: 0.0015, downside_deviation: 0.15,
            liq_rate: 0.01, pct_profitable: 0.62, avg_leverage: 3.0,
            trade_count: 120, days_active: 180,
        }
    }

    #[test]
    fn good_trader_gets_tier() {
        let m = good_metrics();
        let s = compute(&m, 500);
        println!("Score: {}, Confidence: {:.3}", s.score, s.confidence);
        assert!(s.score >= 400, "expected score >= 400, got {}", s.score);
        assert!(s.score <= 1000);
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

    #[test]
    fn zero_liq_dd_guard_is_one() {
        let mut m = good_metrics();
        m.liq_rate = 0.0;
        m.max_dd = 0.0;
        let s = compute(&m, 500);
        assert!(s.score > 0);
    }
}
